const express = require('express');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const cors = require('cors');
const helmet = require('helmet');
const session = require('express-session');

const config = require('./config/index');
const { contentSecurityPolicy, resourcePolicy, embedderPolicy } = require('./config/headers');

const sequelize = require('./config/database');

const router = require('./src/routes/index');

const { writeAdminLog, writeErrorLog } = require('./src/services/index');

const { AdminModel, RoleModel } = require('./src/models/index');
const association = require('./src/models/association/index');

/**
 *  Setup Express app
 */
const app = express();

// configuring template engine and assets path
app.set('view engine', 'ejs');
app.set('views', 'src/views');

app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// configuring express middleware for cookie, json, cors
app.use(cookieParser());
app.use(express.urlencoded({ extended: false })); 
app.use(express.json());
app.use(cors());

app.use((req, res, next) => {
  res.locals.cspNonce = crypto.randomBytes(16).toString("hex");
  next();
});

// configuring headers
app.disable("x-powered-by");
app.use(
  helmet({
    crossOriginResourcePolicy: false,
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  })
);
app.use(helmet.crossOriginResourcePolicy(resourcePolicy));
app.use((req, res, next) => {
  helmet.contentSecurityPolicy(contentSecurityPolicy(res.locals.cspNonce));
  next();
});
app.use(helmet.crossOriginEmbedderPolicy(embedderPolicy));

// configuring db session store
const SequelizeStore = require("connect-session-sequelize")(session.Store);
const store = new SequelizeStore({
  db: sequelize
});

// configuring express sessions
app.use(
  session({
    secret: config.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: store,
    checkExpirationInterval: 15 * 60 * 1000,
    cookie: {
      secure: config.SESSION_COOKIE_SECURE === 'true' ? true : false,
      httpOnly: config.SESSION_COOKIE_HTTPONLY  === 'true' ? true : false,
      maxAge: Number(config.SESSION_COOKIE_MAXAGE)
    }
  })
);

// initializing associations
// if( config.DB_SYNC === 'false' ){
  association.init();
// }

// fetch information of LoggedIn User
app.use((req, res, next) => {
  if( req.session && req.session.isUserLoggedIn && req.session.adminId ){
    try{
      AdminModel.findOne({
        where:{
          id: req.session.adminId
        },
        attributes: ['id', 'code', 'name', 'email', 'username', 'type', 'status', 'isDeleted', 'isBlocked'],
        include: [{
          model: RoleModel,
          as: 'role',
          attributes: ['name', 'rights']
        }]
      })
      .then(admin => {
        if( !admin ){
          next();
        } 
  
        req.admin = admin;
    
        res.locals.isLoggedIn = true,
        res.locals.userInfo = {
          name: admin.name,
          type: admin.type
        }
  
        next();
      })
    }
    catch(err){
      writeErrorLog("FAILED TO FETCH ADMIN DATA", {
        ip: req.ip,
        sessionID: req.sessionID,
        trace: err
      });
    }
  }else{
    next();
  }
});

// configuring routes
app.get('/', (req, res, next) => {
  res.redirect('/admin/signin')
});

try{
  router(app);
}catch(e){
  writeErrorLog("FAILED TO LOAD ROUTE", {
    trace: e
  });
}

module.exports = app;