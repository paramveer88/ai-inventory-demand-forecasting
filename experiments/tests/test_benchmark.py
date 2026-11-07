import copy
from datetime import date,timedelta
from pathlib import Path
import tempfile
import unittest
import openpyxl
from experiments.artifacts import read_json,write_json,digest
from experiments.data import prepare,dates
from experiments.evaluation import seasonal_naive,score,origin_inputs,evaluate,verify_run,verify_dataset
from experiments.cli import check_invariance,validate_config


def observation(day,value,coverage='observed'):
    return {'date':day.isoformat(),'value':value,'coverage':coverage,'availability':'unknown'}

class BaselineTests(unittest.TestCase):
    def test_weekly_pattern_repeats_for_full_thirty_day_horizon(self):
        training=[observation(date(2020,1,1)+timedelta(days=i),i+1) for i in range(7)]
        self.assertEqual(seasonal_naive(training),[1.,2.,3.,4.,5.,6.,7.]*4+[1.,2.])

    def test_a_gap_or_unknown_value_cannot_be_interpreted_as_zero(self):
        training=[observation(date(2020,1,1)+timedelta(days=i),0) for i in range(8)]
        with self.assertRaises(ValueError):seasonal_naive(training[:4]+training[5:])
        training[-1]['value']=None
        with self.assertRaises(ValueError):seasonal_naive(training)

    def test_training_scaled_error_and_bias_are_hand_calculable(self):
        result=score([3,4],[1,7],list(range(1,15)))
        self.assertEqual(result['mae'],2.5)
        self.assertEqual(result['bias_prediction_minus_actual'],-.5)
        self.assertAlmostEqual(result['mase'],2.5/7)
        self.assertEqual(result['cumulative_error'],-1)
        undefined=score([0],[0],[0]*14)
        self.assertIsNone(undefined['mase'])
        self.assertEqual(undefined['mae'],0)

    def test_immutable_artifacts_reject_overwrite(self):
        with tempfile.TemporaryDirectory() as temp:
            path=Path(temp)/'snapshot.json'
            write_json(path,{'value':1},immutable=True)
            write_json(path,{'value':1},immutable=True)
            with self.assertRaises(ValueError):write_json(path,{'value':2},immutable=True)

class WorkbookTests(unittest.TestCase):
    def fixture(self,temp,alter_future=False):
        config=read_json(Path('experiments/configs/retail-v1.json'))
        config.update(train_start='2020-01-01',train_end='2020-03-31',development_start='2020-04-01',development_end='2020-06-30',
                      test_start='2020-07-01',test_end='2020-09-30',cohort_first_observation_by='2020-01-15',
                      cohort_size=2,training_window_days=28,minimum_training_positive_days=3)
        book=openpyxl.Workbook();book.remove(book.active)
        for name,start,end in [('early','2020-01-01','2020-03-31'),('later','2020-03-25','2020-09-30')]:
            sheet=book.create_sheet(name)
            sheet.append(['Invoice','StockCode','Description','Quantity','InvoiceDate','Price','Customer ID','Country'])
            for day in dates(start,end):
                if day.weekday()==5:continue
                for product,quantity in [('10001',1+day.weekday()),('10002',2)]:
                    if alter_future and day>=date(2020,7,1):quantity=999
                    sheet.append(['1',product,'Product',quantity,day,0,None,'UK'])
            # Negative cancellation is separately audited, not subtracted from sales.
            sheet.append(['C2','10001','Return',-3,date.fromisoformat(start),1,None,'UK'])
        path=Path(temp)/('changed.xlsx' if alter_future else 'sample.xlsx');book.save(path)
        return path,config

    def test_audit_overlap_cohort_replay_and_future_invariance(self):
        with tempfile.TemporaryDirectory() as temp:
            raw,config=self.fixture(temp)
            out=Path(temp)/'artifacts'
            directory=prepare(raw,config,out,progress=lambda *a,**k:None)
            first=verify_dataset(directory)
            audit=read_json(directory/'audit.json')
            self.assertIn('2020-04-04',audit['source_wide_empty_dates'])
            self.assertTrue(audit['overlapping_source_dates'])
            self.assertGreater(audit['overlap_units_excluded_by_date_ownership'],0)
            self.assertEqual(first['series']['10001'][1]['value'],4) # Jan 2: weekday 3, one owning sheet
            a=evaluate(directory,out);b=evaluate(directory,out)
            self.assertEqual(read_json(a/'manifest.json')['prediction_sha256'],read_json(b/'manifest.json')['prediction_sha256'])
            self.assertGreater(verify_run(a)['verified_forecasts'],0)
            self.assertEqual(check_invariance(directory)['future_value_invariance'],'passed')
            raw2,config2=self.fixture(temp,alter_future=True)
            changed=prepare(raw2,config2,out,progress=lambda *a,**k:None)
            self.assertEqual(read_json(directory/'cohort.json'),read_json(changed/'cohort.json'))
            train1,_,_=origin_inputs(first,'10001',date(2020,4,1))
            train2,_,_=origin_inputs(verify_dataset(changed),'10001',date(2020,4,1))
            self.assertEqual(seasonal_naive(train1),seasonal_naive(train2))
            # Saved run remains valid after a source workbook is modified.
            self.assertGreater(verify_run(a)['verified_forecasts'],0)
            write_json(a/'inputs'/next((a/'inputs').iterdir()).name,{'tampered':True})
            with self.assertRaises(ValueError):verify_run(a)

    def test_unknown_labels_are_unscored_but_do_not_erase_available_predictions(self):
        with tempfile.TemporaryDirectory() as temp:
            raw,config=self.fixture(temp)
            config['uncertain_dates']=['2020-05-01']
            out=Path(temp)/'artifacts'
            directory=prepare(raw,config,out,progress=lambda *a,**k:None)
            run=evaluate(directory,out)
            summary=read_json(run/'summary.json')
            self.assertGreater(summary['unscored'],0)
            self.assertGreater(summary['excluded'],0)
            self.assertGreater(summary['forecast_availability'],summary['scored_origin_fraction'])
            records=read_json(run/'results.json')['records']
            for record in records:
                if record['status']=='unscored':
                    self.assertEqual(len(record['predictions']),30)
                    self.assertNotIn('metrics',record)
            self.assertGreater(verify_run(run)['verified_forecasts'],0)

    def test_pre_first_unknown_post_last_zero_and_missing_customer_retention(self):
        with tempfile.TemporaryDirectory() as temp:
            raw,config=self.fixture(temp)
            config['cohort_size']=10
            workbook=openpyxl.load_workbook(raw)
            for sheet in workbook:
                for row in sheet.iter_rows(min_row=2):
                    if row[1].value=='10002' and not (date(2020,1,10)<=row[4].value.date()<=date(2020,1,31)):
                        row[3].value=0
            workbook.save(raw);workbook.close()
            directory=prepare(raw,config,Path(temp)/'out',progress=lambda *a,**k:None)
            dataset=verify_dataset(directory)
            series={row['date']:row for row in dataset['series']['10002']}
            self.assertIsNone(series['2020-01-05']['value'])
            self.assertEqual(series['2020-02-10']['value'],0)
            self.assertEqual(series['2020-02-10']['coverage'],'assumed_zero_under_extract_coverage')
            self.assertGreater(read_json(directory/'audit.json')['sheets'][0]['counts']['missing_customer_id'],0)

    def test_unscoped_invalid_dates_leave_an_audit_and_block_preparation(self):
        with tempfile.TemporaryDirectory() as temp:
            raw,config=self.fixture(temp)
            workbook=openpyxl.load_workbook(raw)
            workbook.worksheets[0].append(['bad','10001','Product',3,'invalid',1,None,'UK'])
            workbook.save(raw);workbook.close()
            output=Path(temp)/'out'
            with self.assertRaisesRegex(ValueError,'Unscoped invalid source dates'):
                prepare(raw,config,output,progress=lambda *a,**k:None)
            self.assertEqual(len(list((output/'audits').glob('*.json'))),1)

    def test_final_test_is_not_available_before_protocol_freeze(self):
        with self.assertRaises(ValueError):evaluate(Path('/unused'),Path('/unused'),'test')

if __name__=='__main__':unittest.main()
