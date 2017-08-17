var express = require('express');
var http = require('http');
var path = require('path');
var favicon = require('static-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var _ = require('underscore');

var routes = require('./routes');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'ejs');

app.use(favicon());
app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use(app.router);

var users = {}; //存储在线用户列表的对象

app.get('/', function (req,res){
    if(req.cookies.user == null){
        res.redirect('/login');
    }else{
        res.sendfile('views/index.html');  //写后缀
        // res.render('index'); //错误
    }
});
app.get('/login', function(req,res){
    res.sendfile('views/login.html');
});
app.post('/login',function(req,res){
    if(users[req.body.name]){
        //存在，则不允许登陆
        res.redirect('/login');
    }else{
        //不存在，把用户存入cookie并跳转到主页
        res.cookie("user",req.body.name,{maxAge:1000*60*60*24*30});
        //users[req.body.name] = req.body.name;  上线时 写 浏览器刷新页面 会触发 上线和下线的函数，
        // 导致上线不会加入到列表中
        res.redirect('/');
    }
});

var server = http.createServer(app);
var io = require('socket.io').listen(server);
server.listen(80);
io.sockets.on('connection',function(socket){
    //有人上线
   // console.log("in connection...");
    socket.on('online',function(data){
        //将上线的用户名存储为 socket 对  象的属性，以区分每个 socket对象，方便后面使用
        //console.log("in server online...");
        socket.name = data.user;
        //users 对象中不存在该用户名则插入该用户名
        if(!users[data.user]){
            users[data.user] = data.user;
        }
        //向所有用户广播该用户上线信息
        io.sockets.emit('online',{users:users,user:data.user}); //包括张三
        //socket.emit();  -->向建立该连接的客户端发送 一对一
        //socket.broadcast.emit(); -->向除了建立该连接的客户端的所有客户端进行广播
        //io.sockets.emit(); -->向所有客户端广播，等同于上面两个的和
    });

    //有人发话
    socket.on('say',function(data){
        if(data.to == "all"){
            socket.broadcast.emit('say',data);
        }else{
            //向特定用户发送该用户发话信息
            //版本<1时,clients为存储所有连接对象的数组,返回的是连接此服务器的一个个客户端信息的数组(ip等等)
            //版本>1时，io.sockets.sockets属性返回sockets对象，里面是所有sockets的集合
            var clients = io.sockets.sockets;
            var toSocket;
            if(toSocket = _.findWhere(io.sockets.sockets,{name:data.to})){
                toSocket.emit('say',data);
            }
        }
    });
    //有人下线
    socket.on('disconnect',function () {
        //console.log('in disconnect...');
        //若users对象中保存了该用户名
        if(users[socket.name]){
            //从users对象中删除该用户名
            delete users[socket.name];
            //向其他所有用户广播该用户下线信息
            socket.broadcast.emit('offline',{users:users,user:socket.name});
        }
    });

});


/// catch 404 and forwarding to error handler
app.use(function(req, res, next) {
    var err = new Error('Not Found');
    err.status = 404;
    next(err);
});

/// error handlers

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
    app.use(function(err, req, res, next) {
        res.render('error', {
            message: err.message,
            error: err
        });
    });
}

// production error handler
// no stacktraces leaked to user
app.use(function(err, req, res, next) {
    res.render('error', {
        message: err.message,
        error: {}
    });
});

module.exports = app;
