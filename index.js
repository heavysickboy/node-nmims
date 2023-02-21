const config = require('./config/index.js');
const sequelize = require('./config/database');
const app = require('./app.js');

const { writeServerLog } = require('./src/services/index');

(async () => {
  try {

    if( config.DB_SYNC === 'true' ){
      await sequelize.sync({ alter: true });
      writeServerLog("info", "DB CONNECTION", { description: "Connection has been established & All models were synchronized successfully."});
    }else{
      await sequelize.authenticate();
      writeServerLog("info", "DB CONNECTION", { description: "Connection has been established successfully."});
    }

    app.on('error', (err) => {
      throw err;
    })

    const onListening = () => {
      console.log(`Listening on ${config.PORT}`);

      writeServerLog("info", "SERVER STARTED", { description: `Listening on ${config.PORT}`});
    }

    app.listen(config.PORT, onListening);

  }catch (err) {
    writeServerLog("error", "SERVER FAILED", { trace: err });
  }
})()