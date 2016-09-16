var passport = require('passport'),
	LocalStrategy = require('passport-local').Strategy,
	mongoose = require('mongoose'),
	User = mongoose.model('User');

passport.use(new LocalStrategy({
		usernameField: 'email'
	},
	function (username, password, done) {
		User.findOne({
			email: username
		}, function (err, user) {
			if (err) {
				return done(err);
			}
			if (!user) {
				return done(null, false, {
					message: 'User not found'
				});
			}
			if (!user.validPassword(password)) {
				return done(null, false, {
					message: 'Password is wrong'
				});
			}
			return done(null, user);
		});
	}
));

passport.serializeUser(function (user, done) {
	console.log("serializing " + user.username);
	done(null, user);
});

passport.deserializeUser(function (obj, done) {
	console.log("deserializing " + obj);
	done(null, obj);
});