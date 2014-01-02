var admin       = require('../controllers/admin'),
    config      = require('../config'),
    middleware  = require('../middleware').middleware;

module.exports = function (server) {
    var subdir = config.paths().subdir,
        adminRoot = config().adminRoot,
        redirectRegex,
        oa = new OAuth("https://api.twitter.com/oauth/request_token",
                       "https://api.twitter.com/oauth/access_token",
                       config().twitter.consumerKey,
                       config().twitter.consumerSecret,
                       "1.0",
                       config().url + "/ghost/auth/twitter/callback",
                       "HMAC-SHA1"),
        
    // ### Admin routes
    /* TODO: put these somewhere in admin */
    server.get('/logout/', function redirect(req, res) {
        /*jslint unparam:true*/
        res.redirect(301, subdir + adminRoot + '/signout/');
    });
    server.get('/signout/', function redirect(req, res) {
        /*jslint unparam:true*/
        res.redirect(301, subdir + adminRoot + '/signout/');
    });
    server.get('/signin/', function redirect(req, res) {
        /*jslint unparam:true*/
        res.redirect(301, subdir + adminRoot + '/signin/');
    });
    server.get('/signup/', function redirect(req, res) {
        /*jslint unparam:true*/
        res.redirect(301, subdir + adminRoot + '/signup/');
    });
    server.get(adminRoot + '/login/', function redirect(req, res) {
        /*jslint unparam:true*/
        res.redirect(301, subdir + adminRoot + '/signin/');
    });

    server.get(adminRoot + '/signout/', admin.logout);
    server.get(adminRoot + '/signin/', middleware.redirectToSignup, middleware.redirectToDashboard, admin.login);
    server.get(adminRoot + '/signup/', middleware.redirectToDashboard, admin.signup);
    server.get(adminRoot + '/forgotten/', middleware.redirectToDashboard, admin.forgotten);
    server.post(adminRoot + '/forgotten/', admin.generateResetToken);
    server.get(adminRoot + '/reset/:token', admin.reset);
    server.post(adminRoot + '/reset/:token', admin.resetPassword);
    server.post(adminRoot + '/signin/', admin.auth);
    server.post(adminRoot + '/signup/', admin.doRegister);
    server.post(adminRoot + '/changepw/', middleware.auth, admin.changepw);
    server.get(adminRoot + '/editor(/:id)/', middleware.auth, admin.editor);
    server.get(adminRoot + '/editor/', middleware.auth, admin.editor);
    server.get(adminRoot + '/content/', middleware.auth, admin.content);
    server.get(adminRoot + '/settings*', middleware.auth, admin.settings);
    server.get(adminRoot + '/debug/', middleware.auth, admin.debug.index);

    // We don't want to register bodyParser globally b/c of security concerns, so use multipart only here
    server.post(adminRoot + '/upload/', middleware.auth, admin.uploader);

    server.get(adminRoot + '/auth/twitter/', function (req, res) {
        oa.getOAuthRequestToken(function (error, oauth_token, oauth_token_secret) {
            if (!error) {
                req.session.oauth = {};
                req.session.oauth.token = oauth_token;
                req.session.oauth.token_secret = oauth_token_secret;
                res.redirect('https://twitter.com/oauth/authenticate?oauth_token=' + oauth_token);
            }
        });
    });

    server.get(adminRoot + '/auth/twitter/callback', admin.authorizeTwitter);

    // redirect to adminRoot and let that do the authentication to prevent redirects to /ghost /admin etc. unless
    // adminRoot is set to one of those values.
    redirectRegex = "\/((" +
        _.reject(["ghost", "ghost-admin", "admin", "wp-admin", "dashboard", "signin"],
            function (str) {return str.localeCompare(adminRoot.replace(/\//, "")) === 0; }).join("|")
                + ")\/?)$";

    server.get(new RegExp(redirectRegex), function (req, res) {
        /*jslint unparam:true*/
        res.redirect(subdir + adminRoot + '/');
    });
    server.get(new RegExp("^\/(" + adminRoot.replace(/\//, "") + "$\/?)"), middleware.auth, function (req, res) {
        /*jslint unparam:true*/
        res.redirect(subdir + adminRoot + '/');
    });
    server.get(adminRoot + '/', middleware.redirectToSignup, middleware.auth, admin.index);
};