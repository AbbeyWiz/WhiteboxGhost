var when                   = require('when'),
    _                      = require('underscore'),
    Ntwitter               = require('ntwitter'),
    dataProvider           = require('../models'),
    permissions            = require('../permissions'),
    canThis                = permissions.canThis,
    filteredUserAttributes = require('./users').filteredAttributes,
    settings               = require('./settings'),
    config                 = require('../config'),
    posts;

// ## Posts
posts = {
    tweetPost: function tweetPost(postData) {
        var twitterKey,
            twitterSecret,
            twitter,
            deferred = when.defer();
        if (postData.get("status") === "published" && !postData.get("tweeted")) {
            return when(settings.read('twitterAccessTokenKey')).then(function (key) {
                // we already ran this, chill
                twitterKey = key.value;
                return settings.read("twitterAccessTokenSecret");
            }).then(function (secret) {
                twitterSecret = secret.value;
                twitter = new Ntwitter({
                    consumer_key: config().twitter.consumerKey,
                    consumer_secret: config().twitter.consumerSecret,
                    access_token_key: twitterKey,
                    access_token_secret: twitterSecret
                });
                twitter.updateStatus(postData.get("title") + ": " + config().url + "/" + postData.get("slug"), function (err) {
                    postData.set("tweeted", err === null ? 0 : 1);
                    deferred.resolve(postData);
                });
                return deferred.promise;
            }).then(function (postData) {
                return postData.save();
            });
        }
        return postData;
    },

    // #### Browse

    // **takes:** filter / pagination parameters
    browse: function browse(options) {

        // **returns:** a promise for a page of posts in a json object
        //return dataProvider.Post.findPage(options);
        return dataProvider.Post.findPage(options).then(function (result) {
            var i = 0,
                omitted = result;

            for (i = 0; i < omitted.posts.length; i = i + 1) {
                omitted.posts[i].author = _.omit(omitted.posts[i].author, filteredUserAttributes);
                omitted.posts[i].user = _.omit(omitted.posts[i].user, filteredUserAttributes);
            }
            return omitted;
        });
    },

    // #### Read

    // **takes:** an identifier (id or slug?)
    read: function read(args) {
        // **returns:** a promise for a single post in a json object

        return dataProvider.Post.findOne(args).then(function (result) {
            var omitted;

            if (result) {
                omitted = result.toJSON();
                omitted.author = _.omit(omitted.author, filteredUserAttributes);
                omitted.user = _.omit(omitted.user, filteredUserAttributes);
                return omitted;
            }
            return when.reject({errorCode: 404, message: 'Post not found'});

        });
    },

    // #### Edit

    // **takes:** a json object with all the properties which should be updated
    edit: function edit(postData) {
        // **returns:** a promise for the resulting post in a json object
        if (!this.user) {
            return when.reject({errorCode: 403, message: 'You do not have permission to edit this post.'});
        }
        var self = this;
        return canThis(self.user).edit.post(postData.id).then(function () {
            return dataProvider.Post.edit(postData).then(posts.tweetPost).then(function (result) {
                if (result) {
                    var omitted = result.toJSON();
                    omitted.author = _.omit(omitted.author, filteredUserAttributes);
                    omitted.user = _.omit(omitted.user, filteredUserAttributes);
                    return omitted;
                }
                return when.reject({errorCode: 404, message: 'Post not found'});
            }).otherwise(function (error) {
                return dataProvider.Post.findOne({id: postData.id, status: 'all'}).then(function (result) {
                    if (!result) {
                        return when.reject({errorCode: 404, message: 'Post not found'});
                    }
                    return when.reject({message: error.message});
                });
            });
        }, function () {
            return when.reject({errorCode: 403, message: 'You do not have permission to edit this post.'});
        });
    },

    // #### Add

    // **takes:** a json object representing a post,
    add: function add(postData) {
        // **returns:** a promise for the resulting post in a json object
        if (!this.user) {
            return when.reject({errorCode: 403, message: 'You do not have permission to add posts.'});
        }

        return canThis(this.user).create.post().then(function () {
            return dataProvider.Post.add(postData);
        }, function () {
            return when.reject({errorCode: 403, message: 'You do not have permission to add posts.'});
        }).then(posts.tweetPost);
    },

    // #### Destroy

    // **takes:** an identifier (id or slug?)
    destroy: function destroy(args) {
        // **returns:** a promise for a json response with the id of the deleted post
        if (!this.user) {
            return when.reject({errorCode: 403, message: 'You do not have permission to remove posts.'});
        }

        return canThis(this.user).remove.post(args.id).then(function () {
            return when(posts.read({id : args.id, status: 'all'})).then(function (result) {
                return dataProvider.Post.destroy(args.id).then(function () {
                    var deletedObj = {};
                    deletedObj.id = result.id;
                    deletedObj.slug = result.slug;
                    return deletedObj;
                });
            });
        }, function () {
            return when.reject({errorCode: 403, message: 'You do not have permission to remove posts.'});
        });
    }
};

module.exports = posts;