(function() {
    'use strict';
    angular.module('rssreader').config(['$validatorProvider', function($validatorProvider) {
        $validatorProvider.addMethod("pattern", function(value, element) {
            return this.optional(element) || /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*(_|[^\w])).{6,20}/.test(value);
        }, "Please specify the correct domain for your documents");
    }]).controller('ProfileController', ['Upload', '$http', '$state', 'profileService', '$scope',
        'authService', '$window', 'themeService', 'dashboardService', '$auth', 'accountInfo', 'toasterService',
        function(Upload, $http, $state, profileService, $scope,
            authService, $window, themeService, dashboardService, $auth, accountInfo, toasterService) {
            $scope.currentUser = profileService.refreshProfileData;

            $scope.link = function (provider) {
				$auth.link(provider).then(function () {
					toasterService.info('You have successfully linked a ' + provider + ' account');
					profileService.getProfile();
				});
			};

			$scope.unlink = function (provider) {
				$http.post('/auth/unlink', {
					id: profileService.refreshProfileData()._id,
					provider: provider
				}).then(function (resonse) {
					toasterService.info('You have unlinked a ' + provider + ' account');
					profileService.getProfile();
				});
			};

            $scope.updateProfile = function () {
				profileService.getProfile();
			};

			$scope.newUserData = {
			    email: profileService.refreshProfileData().email,
			    currentPass: "",
			    newPass: "",
			    newPassRepeat: ""
			};

			$scope.submit = function (file) { //function to call on form submit
				if ($scope.upload_form.file.$valid && file) { //check if from is valid
					$scope.upload(file); //call upload function
				}
			};

			$scope.upload = function (file, errFiles) {
			    $scope.f = file;
			    if (errFiles) {
			        $scope.errFile = errFiles[0];
			    }
			    else {
			        $scope.errFile = null;
			    }
			    if (file) {
			        Upload.upload({
			            url: '/users/' + authService.userID() + '/upload', //webAPI exposed to upload the file
			            data: {
			                file: file,
			                user: authService.userID()
			            }, //pass file as data, should be user ng-model
			            headers: {
			                Authorization: 'Bearer ' + authService.getToken()
			            }
			        }).then(function (res) { //upload function returns a promise
			            if (res.data.error_code === 0) { //validate success
			                profileService.getProfile();
			            } else {
			                $window.alert('an error occured');
			            }
			        }, function (err) { //catch error
			            if (err.status > 0)
			                $scope.errorMsg = err.status + ': ' + err.data;
			        });
			    }
			};

            var PROFILE_ERRORS = {
				field_required: 'This field is required',
				email_example: 'Please, use example: jacksparrow@gmail.com',
				min_6symbl: 'Please,enter at least 6 characters',
				min_9symbl: 'Please,enter at least 9 characters',
				max_20symbl: 'Please,no more then 20 characters',
				reg_exp: 'Password must contain(a-z,A-Z,0-9,!@#)'
			};

            $scope.changePass = function (form) {
				if (form.validate()) {
					console.log("Submit change password");
					return $http.post('/changePassword', $scope.newUserData, {
						headers: {
							Authorization: 'Bearer ' + authService.getToken()
						}
					}).success(function (data) {
						toasterService.success('You have successfully changed pswd');
						authService.saveToken(data.token);
						$state.go('dashboard.' + dashboardService.getViewMode(), {
							id: authService.userID()
						});
					}).error(function (err) {
						$scope.err = err;
						console.log(err.message);
					});
				}
			};

            $scope.changePassValidation = {
				rules: {
					currentPassword: {
						required: true
					},
					newPassword: {
						required: true,
						minlength: 6,
						maxlength: 40,
						pattern: true
					},
					repeatNewPassword: {
						required: true
					}
				},
                messages: {
					currentPassword: {
						required: PROFILE_ERRORS.field_required,
						email: PROFILE_ERRORS.email_example,
						minlength: PROFILE_ERRORS.min_9symbl,
						maxlength: PROFILE_ERRORS.max_20symbl
					},
					newPassword: {
						required: PROFILE_ERRORS.field_required,
						minlength: PROFILE_ERRORS.min_6symbl,
						maxlength: PROFILE_ERRORS.max_20symbl,
						pattern: PROFILE_ERRORS.reg_exp
					},
					repeatNewPassword: {
						required: PROFILE_ERRORS.field_required
					}
				}
			};

            $scope.changeTheme = function() {
                $scope.modalShown = !$scope.modalShown;
            };

            $scope.updateTheme = function(layout) {
                themeService.changeTheme(layout.url).error(function(error) {
                    console.log("theme not changed" + error);
                }).then(function(response) {
                    profileService.getProfile();
                });
            };
            $scope.layouts = themeService.layouts;
        }
    ]);
})();
