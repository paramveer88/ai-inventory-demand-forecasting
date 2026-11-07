"""CLI for deliveries A/B. Nothing imports the running ERP or a database client."""
from __future__ import annotations
import argparse
from datetime import date
import json
from pathlib import Path
import tempfile
import urllib.request
import zipfile
from .artifacts import digest, file_digest, read_json, write_json
from .data import prepare
from .evaluation import evaluate, verify_run, verify_dataset, origin_inputs, seasonal_naive

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CONFIG = ROOT / 'experiments/configs/retail-v1.json'
DEFAULT_OUTPUT = ROOT / 'experiments/artifacts'


def get_source(raw_dir: Path):
    source = read_json(ROOT / 'experiments/sources/online_retail_ii.json')
    raw_dir.mkdir(parents=True, exist_ok=True)
    workbook = raw_dir / source['workbook']
    if not workbook.exists():
        print('Downloading the pinned UCI workbook (approximately 44 MB)…', flush=True)
        with tempfile.TemporaryDirectory(dir=raw_dir) as temp:
            archive = Path(temp)/'source.zip'
            with urllib.request.urlopen(source['download_url'], timeout=90) as response, archive.open('wb') as dest:
                size=0
                while chunk := response.read(1024*1024):
                    size += len(chunk)
                    if size>100_000_000:
                        raise ValueError('Unexpected source size')
                    dest.write(chunk)
            with zipfile.ZipFile(archive) as z:
                members=[n for n in z.namelist() if n.split('/')[-1]==source['workbook']]
                if len(members)!=1 or z.getinfo(members[0]).file_size>100_000_000:
                    raise ValueError('Unexpected source archive')
                candidate=Path(temp)/source['workbook']
                with z.open(members[0]) as src, candidate.open('wb') as dest:
                    while chunk:=src.read(1024*1024):dest.write(chunk)
                if file_digest(candidate)!=source['workbook_sha256']:
                    raise ValueError('Source checksum mismatch; do not silently accept a changed dataset')
                candidate.replace(workbook)
    if file_digest(workbook)!=source['workbook_sha256']:
        raise ValueError('Source checksum mismatch; original raw bytes must be restored')
    return workbook


def validate_config(config):
    if config['horizon']!=30 or config['seasonal_period']!=7 or config['stride']!=7:
        raise ValueError('v1 protocol fixes a 30-day horizon, weekly seasonality and weekly origins')
    if config['training_window_days']<7:
        raise ValueError('Training window cannot be shorter than the baseline context')
    if not (config['train_start'] <= config['train_end'] < config['development_start'] <= config['development_end'] < config['test_start'] <= config['test_end']):
        raise ValueError('Periods must be chronological and non-overlapping')
    if config['target']!='gross_invoiced_units' or config['evaluation_partition']!='development':
        raise ValueError('Only the accepted invoice/development protocol is available in A/B')
    implemented = {
        'pre_first_observation':'unknown', 'post_last_sale':'continue_under_coverage_assumption',
        'ordinary_empty_product_day':'assumed_zero', 'source_empty_day':'assumed_zero_under_complete_extract',
        'boundary_dates':'unknown', 'cohort_sampling':'seeded_round_robin_training_zero_fraction_quartiles',
        'sheet_overlap':'last_workbook_sheet_owns_overlapping_calendar_date',
        'duplicate_looking_rows':'retain_within_owning_sheet', 'zero_price':'retain_eligible_unit_sales_flag_in_audit',
        'unknown_training':'block_whole_origin', 'unknown_evaluation':'exclude_whole_origin_for_all_methods',
        'score_aggregation':'macro_product_mean_and_separate_unit_volume_weighting','model':'weekly_seasonal_naive',
    }
    for name, policy in implemented.items():
        if config[name] != policy:
            raise ValueError(f'Unsupported policy change: {name}')



def prepared(config_path: Path, output: Path, raw_dir: Path):
    config=read_json(config_path)
    validate_config(config)
    workbook=get_source(raw_dir)
    identity=digest({'config':config,'source':file_digest(workbook),'preparation_code':file_digest(Path(__file__).with_name('data.py'))})
    index=output/'indexes'/f'{identity}.json'
    if index.exists():
        directory=output/'datasets'/read_json(index)['dataset_sha256']
        verify_dataset(directory)
        print(f'Using verified prepared dataset: {directory.name}',flush=True)
        return directory
    directory=prepare(workbook,config,output)
    write_json(index,{'dataset_sha256':directory.name},immutable=True)
    return directory


def check_invariance(dataset_dir: Path):
    dataset=verify_dataset(dataset_dir)
    result_count=0
    from .evaluation import schedule
    for product in sorted(dataset['series']):
        for origin in schedule(dataset['config'],'development'):
            training,_,reasons=origin_inputs(dataset,product,origin)
            if 'UNKNOWN_TRAINING_OBSERVATION' in reasons:
                continue
            original=seasonal_naive(training)
            # Change every future observation, preserving labels separately.
            altered=json.loads(json.dumps(dataset))
            for row in altered['series'][product]:
                if row['date']>origin.isoformat():row['value']=999999
            changed,_,_=origin_inputs(altered,product,origin)
            if original!=seasonal_naive(changed):raise ValueError('Future-value invariance failed')
            result_count+=1
            break
    if not result_count:raise ValueError('No eligible origin for invariance check')
    return {'products_checked':result_count,'future_value_invariance':'passed'}


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command',choices=['prepare','evaluate','verify','check-invariance','reproduce'])
    parser.add_argument('--config',type=Path,default=DEFAULT_CONFIG)
    parser.add_argument('--output',type=Path,default=DEFAULT_OUTPUT)
    parser.add_argument('--raw-dir',type=Path,default=ROOT/'experiments/data/raw')
    parser.add_argument('--dataset',type=Path)
    parser.add_argument('--run',type=Path)
    args=parser.parse_args()
    if args.command=='verify':
        if not args.run:parser.error('verify requires --run')
        print(json.dumps(verify_run(args.run),indent=2));return
    directory=args.dataset or prepared(args.config,args.output,args.raw_dir)
    dataset = verify_dataset(directory)
    lock_path = ROOT/'experiments/reports/protocol-lock-v1.json'
    if lock_path.exists():
        lock=read_json(lock_path)
        if digest(dataset['config']) == lock['config_sha256']:
            if dataset['cohort_sha256'] != lock['cohort_sha256'] or dataset['source_sha256'] != lock['source_sha256'] or dataset['dataset_sha256'] != lock['dataset_sha256']:
                raise ValueError('Frozen dataset/cohort/source identity differs; do not silently replace it')
    if args.command=='prepare':
        print(f'Dataset: {directory}');return
    if args.command=='check-invariance':
        print(json.dumps(check_invariance(directory),indent=2));return
    first=evaluate(directory,args.output)
    print(f'Run: {first}',flush=True)
    summary=read_json(first/'summary.json')
    print(json.dumps({k:v for k,v in summary.items() if k!='products'},indent=2),flush=True)
    print("Product       Scored/Planned       MAE       Bias       MASE",flush=True)
    for row in summary['products']:
        number=lambda value: f"{value:.3f}" if value is not None else "undefined"
        print(f"{row['product']:<12} {row['completed']:>3}/{row['planned']:<3} {number(row['mae']):>13} {number(row['bias']):>10} {number(row['mase']):>10}",flush=True)
    print(json.dumps(verify_run(first),indent=2),flush=True)
    if args.command=='reproduce':
        second=evaluate(directory,args.output)
        a,b=read_json(first/'manifest.json'),read_json(second/'manifest.json')
        if a['prediction_sha256']!=b['prediction_sha256']:
            raise ValueError('Independent runs produced different prediction/metric hashes')
        print(json.dumps({'second_run':str(second),'predictions_and_metrics_reproduced':True,**check_invariance(directory)},indent=2))

if __name__=='__main__':main()
