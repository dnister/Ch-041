(function () {
	'use strict';
	angular.module('rssreader').controller('NavbarController', ['$scope', '$state','profileService', 'authService', 'dashboardService', 'transfer', 'accountInfo', '$auth',
		function ($scope, $state,profileService, authService, dashboardService, transfer, accountInfo, $auth) {
			$scope.isLoggedIn = authService.isLoggedIn;
			$scope.isDashboard = function () {
				return /dashboard/.test($state.current.name);
			}
			$scope.currentUser = profileService.refreshProfileData;
			$scope.toggleSidebar = function () {
			    $scope.hideMobileNavbar();
				dashboardService.sidebar = !dashboardService.sidebar;
				$scope.getProfile();
			}

			$scope.hideSidebar = function () {
				dashboardService.sidebar = false;
			}

			$scope.hideMobileNavbar = function () {
			    angular.element(document.querySelector("#bs-example-navbar-collapse-1")).removeClass('in');
			}

			$scope.toProfile = function () {
			    $scope.hideMobileNavbar();
			    $scope.hideSidebar();
			    $state.go("profile");
			}

			$scope.logOut = function () {
			    $scope.hideMobileNavbar();
				authService.logOut();
				$state.go("home");
			}

			$scope.onEmblem = function () {
			    $scope.hideMobileNavbar();
				if (authService.isLoggedIn()) {
				    if ($state.current.name === "dashboard.list" || $state.current.name === "dashboard.th-list" || $state.current.name === "dashboard.th-large") {
						$state.reload('dashboard');
					}
					else $state.go("dashboard." + dashboardService.getViewMode());
				} else {
					$state.go("home");
				}
			}
			$scope.goToProgile = function () {
			    $state.go("profile");
			    $scope.hideMobileNavbar();
			}
			$scope.getProfile = function () {
				accountInfo.getProfile().then(function (response) {
					if ($auth.isAuthenticated()) {
						var lenght = response.data.user.length;
						for (var i = 0; i < lenght; i++) {
							if (response.data.user[i].email === $auth.getPayload().email) {
								$scope.profile = response.data.user[i];
							}
						}
					}
				})
			};
			$scope.getProfile();
			$scope.getImage = function(){
				return profileService.getImage();
			};
	}]);
})();