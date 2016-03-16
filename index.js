require('fs').readdirSync(__dirname, (err, files) => {
    console.log(listing files in directory);
    console.log(files);
});

require('./lib/server')({ port: 1234 }).start();
