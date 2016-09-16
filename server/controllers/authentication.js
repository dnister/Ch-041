var passport = require('passport'),
	mongoose = require('mongoose'),
	User = mongoose.model('User'),
	moment = require('moment'),
	jwt = require('jwt-simple'),
	config = require('../config/config'),
	request = require('request'),
	qs = require('querystring'),
	nev = require('email-verification')(mongoose),
	ERRORS = {
		fill_out_fields: 'Please fill out all fields',
		user_not_found: 'User not found',
		pass_not_match: 'Passwords does\'t match',
		same_pass: 'Please enter new password',
		pass_incorrect: 'Entered password is incorrect',
		user_exist: 'That user already exists',
		invalid_data: 'Invalid email or password'
};

function createJWT(user) {
	var payload = {
		sub: user._id,
		email: user.email,
		iat: moment().unix(),
		exp: moment().add(10, 'days').unix()
	};
	return jwt.encode(payload, config.TOKEN_SECRET);
}

function ensureAuth(req, res) {
	User.findById(req.user, function (err, user) {
		if (!user) {
			return res.status(400).send({
				message: 'User not found'
			});
		}
		user.displayName = req.body.displayName || user.displayName;
		user.email = req.body.email || user.email;
		user.save(function (err) {
			res.status(200).end();
		});
	});
};


module.exports.register = function (req, res) {

	var passAccepted = false;

	if (!req.body.email || !req.body.password || !req.body.repPassword) {
		return res.status(400).json({
			message: ERRORS.fill_out_fields
		});
	}
	if (req.body.password !== req.body.repPassword) {
		return res.status(400).json({
			message: ERRORS.pass_not_match
		});
	}
	if (/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*(_|[^\w])).+$/.test(req.body.password)) {
		passAccepted = true;
	}
	else {
		return res.status(400).json({
			message: ERRORS.pass_not_match
		});
	}
	if (passAccepted) {
		User.findOne({
			email: req.body.email
		}, function (err, existingUser) {
			if (existingUser && (existingUser.google || existingUser.facebook)) {
				existingUser.password = req.body.password;
				existingUser.save(function (err, existingUser) {
					if (err) {
						res.status(500).send({
							message: err.message
						});
					}
				})
				return res.send({
					token: createJWT(existingUser),
					existingUser: existingUser
				});
			}
			if (existingUser && (!existingUser.google || !existingUser.facebook)) {
				return res.status(409).send({
					message: 'Email is already taken'
				});
			}
			var user = new User({
				displayName: req.body.displayName,
				email: req.body.email,
				password: req.body.password
			});

			user.save(function (err, result) {
				if (err) {
					res.status(500).send({
						message: err.message
					});
				}
				res.send({
					token: createJWT(result),
					user: user
				});
			});
		});
	}
};

module.exports.login = function (req, res) {
	User.findOne({
		email: req.body.email
	}, '+password', function (err, user) {
		if (!user) {
			return res.status(401).send({
				message: ERRORS.invalid_data
			});
		}
		user.comparePassword(req.body.password, function (err, isMatch) {
			if (!isMatch) {
				return res.status(401).send({
					pwd: user.password,
					message: ERRORS.invalid_data
				});
			}
			res.send({
				token: createJWT(user),
				user: user
			});
		});
	});
};

module.exports.getUserInfo = function (req, res) {
	User.find(req.user, function (err, user) {
		res.send({
			user: user
		});
	});

}
module.exports.putUserInfo = function (req, res) {
	User.findById(req.user, function (err, user) {
		if (!user) {
			return res.status(400).send({
				message: 'User not found'
			});
		}
		user.displayName = req.body.displayName || user.displayName;
		user.email = req.body.email || user.email;
		user.save(function (err) {
			res.status(200).end();
		});
	});
}

module.exports.googleAuth = function (req, res) {
	var accessTokenUrl = 'https://accounts.google.com/o/oauth2/token',
		peopleApiUrl = 'https://www.googleapis.com/plus/v1/people/me/openIdConnect',
		params = {
			code: req.body.code,
			client_id: req.body.clientId,
			client_secret: config.GOOGLE_SECRET,
			redirect_uri: req.body.redirectUri,
			grant_type: 'authorization_code'
		};


	request.post(accessTokenUrl, {
		json: true,
		form: params
	}, function (err, response, token) {
		var accessToken = token.access_token,
			headers = {
				Authorization: 'Bearer ' + accessToken
			};
		request.get({
			url: peopleApiUrl,
			headers: headers,
			json: true
		}, function (err, response, profile) {
			if (profile.error) {
				return res.status(500).send({
					message: profile.error.message
				});
			}

			if (req.header('Authorization')) {
				User.findOne({
					google: profile.sub
				}, function (err, existingUser) {
					if (existingUser) {
						return res.status(409).send({
							message: 'There is already a Google account that belongs to you'
						});
					}
					var token = req.header('Authorization').split(' ')[1],
						payload = jwt.decode(token, config.TOKEN_SECRET);
					User.findById(payload.sub, function (err, user) {
						if (!user) {
							return res.status(400).send({
								message: 'User not found'
							});
						}
						user.google = profile.sub;
						user.email = profile.email;
						user.picture = user.picture || profile.picture.replace('sz=100', 'sz=100');
						user.displayName = user.displayName || profile.name;
						user.save(function () {
							var token = createJWT(user);
							console.log('google: ' + token);
							res.send({
								token: token
							});
						});
					});
				});
			} else {

				User.findOne({
					google: profile.sub
				}, function (err, existingUser) {
					if (existingUser) {
						return res.send({
							token: createJWT(existingUser),
							profile: profile
						});
					}
					var user = new User();
					user.email = profile.email;
					user.google = profile.sub;
					user.picture = profile.picture.replace('sz=50', 'sz=200');
					user.displayName = profile.name;
					user.save(function (err) {
						var token = createJWT(user);
						console.log(token + 'server');
						res.send({
							token: token,
							profile: profile,
							user: user
						});
					});
				});
			}
		});
	});
}
module.exports.facebookAuth = function (req, res) {
	var fields = ['id', 'email', 'first_name', 'last_name', 'link', 'name'],
		accessTokenUrl = 'https://graph.facebook.com/v2.5/oauth/access_token',
		graphApiUrl = 'https://graph.facebook.com/v2.5/me?fields=' + fields.join(','),
		params = {
			code: req.body.code,
			client_id: req.body.clientId,
			client_secret: config.FACEBOOK_SECRET,
			redirect_uri: req.body.redirectUri
		};

	request.get({
		url: accessTokenUrl,
		qs: params,
		json: true
	}, function (err, response, accessToken) {
		if (response.statusCode !== 200) {
			return res.status(500).send({
				message: accessToken.error.message
			});
		}

		request.get({
			url: graphApiUrl,
			qs: accessToken,
			json: true
		}, function (err, response, profile) {
			if (response.statusCode !== 200) {
				return res.status(500).send({
					message: profile.error.message
				});
			}
			if (req.header('Authorization')) {
				User.findOne({
					facebook: profile.id
				}, function (err, existingUser) {
					if (existingUser) {
						return res.status(409).send({
							message: 'There is already a Facebook account that belongs to you'
						});
					}
					var token = req.header('Authorization').split(' ')[1];
					var payload = jwt.decode(token, config.TOKEN_SECRET);
					User.findById(payload.sub, function (err, user) {
						if (!user) {
							return res.status(400).send({
								message: 'User not found'
							});
						}
						user.facebook = profile.id;
						user.picture = user.picture || 'https://graph.facebook.com/v2.3/' + profile.id + '/picture?type=large';
						user.displayName = user.displayName || profile.name;
						user.save(function () {
							var token = createJWT(user);
							res.send({
								token: token
							});
						});
					});
				});
			} else {

				User.findOne({
					facebook: profile.id
				}, function (err, existingUser) {
					if (existingUser) {
						var token = createJWT(existingUser);
						return res.send({
							token: token,
							profile: profile
						});
					}
					var user = new User();
					user.email = profile.email;
					user.facebook = profile.id;
					user.picture = 'https://graph.facebook.com/' + profile.id + '/picture?type=large';
					user.displayName = profile.name;
					user.save(function () {
						var token = createJWT(user);
						res.send({
							token: token,
							profile: profile
						});
					});
				});
			}
		});
	});
}


module.exports.twitterAuth = function(req, res) {
	var requestTokenUrl = 'https://api.twitter.com/oauth/request_token';
	var accessTokenUrl = 'https://api.twitter.com/oauth/access_token';
	var profileUrl = 'https://api.twitter.com/1.1/users/show.json?screen_name=';

	if (!req.body.oauth_token || !req.body.oauth_verifier) {
		var requestTokenOauth = {
			consumer_key: config.TWITTER_KEY,
			consumer_secret: config.TWITTER_SECRET,
			callback: req.body.redirectUri
		};

		request.post({ url: requestTokenUrl, oauth: requestTokenOauth }, function(err, response, body) {
			var oauthToken = qs.parse(body);
		
			res.send(oauthToken);
		});
	} else {
		var accessTokenOauth = {
			consumer_key: config.TWITTER_KEY,
			consumer_secret: config.TWITTER_SECRET,
			token: req.body.oauth_token,
			verifier: req.body.oauth_verifier
		};
	  
		request.post({ url: accessTokenUrl, oauth: accessTokenOauth }, function(err, response, accessToken) {

			accessToken = qs.parse(accessToken);

			var profileOauth = {
				consumer_key: config.TWITTER_KEY,
				consumer_secret: config.TWITTER_SECRET,
				oauth_token: accessToken.oauth_token
			};

			request.get({
				url: profileUrl + accessToken.screen_name,
				oauth: profileOauth,
				json: true
			}, function(err, response, profile) {

				if (req.header('Authorization')) {
					User.findOne({ twitter: profile.id }, function(err, existingUser) {
						if (existingUser) {
							return res.status(409).send({ message: 'There is already a Twitter account that belongs to you' });
						}

						var token = req.header('Authorization').split(' ')[1];
						var payload = jwt.decode(token, config.TOKEN_SECRET);

						User.findById(payload.sub, function(err, user) {
							if (!user) {
								return res.status(400).send({ message: 'User not found' });
							}

							user.twitter = profile.sub;
							user.email = profile.email;		
							user.displayName = user.displayName || profile.name;
							user.picture = user.picture || profile.profile_image_url.replace('_normal', '');
							user.save(function(err) {
								res.send({ 
									token: createJWT(user), 
									profile : profile
								});
							});
						});
					});
				} else {
					User.findOne({ twitter: profile.sub }, function(err, existingUser) {
						if (existingUser) {
							return res.send({ 
								token: createJWT(existingUser), 
								profile : profile				
							});
						}

						var user = new User();
						user.email = profile.email;  
						user.twitter = profile.sub;
						user.displayName = profile.name;
						user.picture = profile.profile_image_url.replace('_normal', '');
						user.save(function() {
							res.send({ 
								token: createJWT(user), 
								profile : profile	
							});
						});
					});
				}
			});
		});
	}
};

module.exports.unlink = function (req, res) {
	var provider = req.body.provider
	providers = ['facebook', 'google'];
	if (providers.indexOf(provider) === -1) {
		return res.status(400).send({
			message: 'Unknown OAuth Provider'
		});
	}

	User.findById(req.body.id, function (err, user) {
		if (!user) {
			return res.status(400).send({
				message: 'User Not Found'
			});
		}
		user[provider] = undefined;
		user.save(function () {
			res.status(200).end();
		});
	});
};


module.exports.changePassword = function (req, res, next) {
	if (!req.body.currentPass || !req.body.newPass || !req.body.newPassRepeat) {
		return res.status(400).json({
			message: ERRORS.fill_out_fields
		});
	}

	if (req.body.newPass !== req.body.newPassRepeat) {
		return res.status(400).json({
			message: ERRORS.pass_not_match
		});
	}
	if (req.body.newPass == req.body.newPassRepeat && req.body.newPass == req.body.currentPass) {
		return res.status(400).json({
			message: ERRORS.same_pass
		});
	}

	User.findOne({
		email: req.body.email
	}, function (err, user) {
		if (user === undefined) {
			return res.status(400).json({
				message: ERRORS.user_not_found
			});
		} else {
			if (req.body.currentPass) {
				user.password = req.body.newPass;

				user.save(function (err) {
					if (err) {
						return next(err);
					}
					res.status(200);
					res.json({
						"token": createJWT(user)
					});

				});
			} else {
				return res.status(400).json({
					message: ERRORS.pass_incorrect
				});
			}
		}
	});
}
module.exports.emailVerification = function (req, res) {
	var email = req.body.email;

	nev.resendVerificationEmail(email, function (err, userFound) {
		if (err) {
			return res.status(404).send('ERROR: resending verification email FAILED');
		}
		if (userFound) {
			res.json({
				msg: 'An email has been sent to you, yet again. Please check it to verify your account.'
			});
		} else {
			res.json({
				msg: 'Your verification code has expired. Please sign up again.'
			});
		}
	});
	
};