require('fs').readdirSync(`${__dirname}`, (err, files) => {
    console.log(files);
});

require('./lib/server')({ port: 1234 }).start();
