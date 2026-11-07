# How to run this project

**To open the application, use `bash start.sh`.**

**To run the separate research experiment, use `bash run-research.sh`.**

You do not need to start each part of the application separately.

## 1. Open the project folder

Open a terminal and run:

```bash
cd /home/tdc21/Desktop/PROJECTSSSSSS/Ai-Inventory-Demand-Forecasting
```

Run the remaining commands from this folder—the one containing this file and `start.sh`.

If you move the project or use another computer, replace the path above with its new location. You can also open the folder in your file manager and choose **Open Terminal Here**.

## 2. Start the application

```bash
bash start.sh
```

Wait until the terminal prints:

```text
4/4 Ready. Open http://127.0.0.1:5173
```

Open the address printed by **your terminal**. The number may be different if another application is using that address.

You should see the original animated landing page. Click **Launch Dashboard** to open the application.

**Keep this terminal open while using the app.** The script starts the database, backend, frontend, forecasting service, and connection worker for you. The first start can take a few minutes because it installs what the project needs.

### If Connections asks for a token

The normal dashboard does not need a token. Only the additional **Connections** tab asks for one.

Find this line in the startup terminal:

```text
Connections tab token (only needed there): ...
```

Copy the long string after the colon, paste it into that tab, and click **Open workspace**. Keep the token private. The current connection is a sample source for testing.

## 3. Stop or restart the application

To stop, click the startup terminal and press **Ctrl+C**.

To start again, run:

```bash
bash start.sh
```

Refresh the browser after restarting. If the script says the app is already running, use its existing terminal or press Ctrl+C there before starting another copy.

The local database stays available in the background so your data is preserved. If you also want to stop it:

```bash
docker stop smarterp-quickstart-mongo
```

The next `bash start.sh` starts it again. Stopping it does not delete its data.

## 4. Run the research experiment—only when wanted

This evaluates the historical sales dataset and prints results in the terminal. It does not open the website, and the app does not need to be running.

From the same project folder:

```bash
bash run-research.sh
```

The first run downloads the dataset and prepares it. Later runs reuse the saved data. Let the command finish; it returns you to the normal terminal prompt.

Successful output includes:

```text
"predictions_and_metrics_reproduced": true
"future_value_invariance": "passed"
```

The terminal prints the location of each saved run. Full results are under `experiments/artifacts/runs/`. The first checkpoint report is [here](experiments/reports/CHECKPOINT_AB.md).

## 5. Returning after a long time or using a new computer

The computer needs these tools installed:

| Tool | Version to use |
| --- | --- |
| Node.js | 22 or newer |
| pnpm | 10 or newer |
| Python | 3.12 or newer recommended |
| Docker | Installed and running |

If startup reports a missing tool, check with:

```bash
node --version
pnpm --version
python3 --version
docker --version
```

Install the missing tool, then run `bash start.sh` again. The startup script handles the project's own dependency installation. Internet access is needed for first-time downloads and for an existing online database, if configured.

If Docker is installed but not running, open Docker Desktop. On a Linux installation using the Docker system service, you can instead run:

```bash
sudo systemctl start docker
```

Then retry:

```bash
bash start.sh
```

Keep a private backup of `backend/.env` and your database if you want your existing business records on another computer. Local settings and database contents are not automatically included in a fresh Git download. The startup script uses your existing database setting when present; without it, the local app database may initially be empty.

If startup fails, read the final error in the terminal. Additional details are saved in `.local/` in files such as `backend.log`, `frontend.log`, and `ml.log`. Keep these files for troubleshooting rather than deleting your database or local settings.
