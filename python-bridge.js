const { spawn } = require('child_process');
const path = require('path');

class PythonBridge {
    constructor() {
        this.pythonPath = 'python3';
        this.scriptsPath = path.join(__dirname, 'python-scripts');
    }

    // Python scriptini çalıştır
    async runPythonScript(scriptName, args = []) {
        return new Promise((resolve, reject) => {
            const scriptPath = path.join(this.scriptsPath, scriptName);
            const pythonProcess = spawn(this.pythonPath, [scriptPath, ...args], {
                cwd: this.scriptsPath
            });

            let output = '';
            let errorOutput = '';

            pythonProcess.stdout.on('data', (data) => {
                output += data.toString();
            });

            pythonProcess.stderr.on('data', (data) => {
                errorOutput += data.toString();
            });

            pythonProcess.on('close', (code) => {
                if (code === 0) {
                    try {
                        const result = JSON.parse(output);
                        resolve(result);
                    } catch (e) {
                        resolve({ success: true, data: output.trim() });
                    }
                } else {
                    reject(new Error(`Python script failed: ${errorOutput}`));
                }
            });

            pythonProcess.on('error', (error) => {
                reject(new Error(`Failed to start Python process: ${error.message}`));
            });
        });
    }

    // Veritabanı yedekleme
    async backupDatabase() {
        try {
            const result = await this.runPythonScript('backup_db.py');
            return result;
        } catch (error) {
            console.error('Database backup failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Veri analizi
    async analyzeData() {
        try {
            const result = await this.runPythonScript('analyze_data.py');
            return result;
        } catch (error) {
            console.error('Data analysis failed:', error.message);
            return { success: false, error: error.message };
        }
    }

    // Rapor oluşturma
    async generateReport(reportType = 'monthly') {
        try {
            const result = await this.runPythonScript('generate_report.py', [reportType]);
            return result;
        } catch (error) {
            console.error('Report generation failed:', error.message);
            return { success: false, error: error.message };
        }
    }
}

module.exports = PythonBridge;