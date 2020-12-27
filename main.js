const {app, BrowserWindow, ipcMain} = require("electron"),
    path = require("path"),
    {exec} = require('child_process'),
    ffmpeg = require('ffmpeg-static'),
    ffprobe = require('ffprobe-static').path,
    readline = require('readline');


function createWindow() {
    mainWindow = new BrowserWindow({
        width: 500,
        height: 400,
        webPreferences: {
            contextIsolation: false, worldSafeExecuteJavaScript: true,
            nodeIntegration: true
        }
    });

    mainWindow.loadFile("index.html");
}

// ffmpeg -i input -filter:a "atempo=1.5" -vn output.mp3
function changeSpeed(input, output, speed) {
    let runCommand = `${ffmpeg} -i "${input}" -filter:a "atempo=${speed}" -vn "${output}"`;
    return runCommand;
}

function formatDuration(input) {
    if (input === '0:00:0') {
        return '0:00:00';
    }
    let inputArray = input.split(':');
    let seconds = Number(inputArray[inputArray.length - 1]);
    seconds = seconds.toFixed(0);
    if (seconds < 10) {
        seconds = '0' + seconds;
    }
    inputArray[inputArray.length - 1] = String(seconds);
    output = inputArray.join(":");
    return output;
}

 // ffprobe -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal input.mp4
function getDuration(input) {
    let runCommand = `${ffprobe} -v error -show_entries format=duration -of default=noprint_wrappers=1:nokey=1 -sexagesimal "${input}"`;
    return runCommand;
}

app.whenReady().then(() => {
    createWindow();

    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0)
            createWindow();
    });
})

ipcMain.on("submit", (e, args) => {
    const [filepath, speed] = args,
        extension = path.extname(filepath),
        filename = path.basename(filepath, extension) + "_sped.mp3",
        cwd = path.dirname(filepath),
        output = path.join(cwd, filename);

    console.log("Input file: " + path.basename(filepath));
    console.log("Speed: " + speed);
    console.log("Output file: ", filename, '\n');
    console.log('starting conversion...');

    const execCommand = exec(changeSpeed(filepath, output, speed));
    const rl = readline.createInterface({
        input: execCommand.stderr,
        crlfDelay: Infinity
    });
   
    rl.on('line', text => {
        if (text.startsWith('size=')) {
            var outputDuration = text.slice(22,32);
            process.stdout.write(`Output Duration: ${outputDuration}\r`);
            if(mainWindow instanceof BrowserWindow)
                mainWindow.webContents.send('completed', formatDuration(outputDuration));
        }
    });

    execCommand.on('close', () => {
        const newLineString = (process.platform === 'win32') ? '\n' : '\n';
        process.stdout.write(newLineString);
        console.log('done with conversion!')
    })
});

ipcMain.on('file_selected', (e, filepath) => {
    exec(getDuration(filepath), (err, stdout) => {
        if (err) {
            console.error(err);
            process.exit(1);
        }
        else {
            if(mainWindow instanceof BrowserWindow){
                mainWindow.webContents.send('duration', formatDuration(stdout));
            }
        }
    });

})

app.on('window-all-closed', () => {
    if (process.platform !== "darwin") app.quit()
});