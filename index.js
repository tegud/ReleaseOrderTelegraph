require('fs').readdirSync(`${__dirname}/node_modules`, (err, files) => {
    console.log(files);
});

require('./lib/server')({ port: 1234 }).start();
