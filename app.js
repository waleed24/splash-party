const config = require('./config');

const _ = require('lodash');
const chalk = require('chalk').bgBlack;
const ip = require('ip');
const Nightmare = require('nightmare');
const request = require('request');
const util = require('util');

let uploadedSource = false;
let pastSplash = false;

// logging
let error = chalk.bold.red;
let cyan = chalk.cyan;
let green = chalk.green;
let yellow = chalk.yellow;

Nightmare.action('show',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('show', (done) => {
			win.show();
			done();
		}
	);
	done();
	},
	function (done) {
		this.child.call('show', done);
	}
);

Nightmare.action('hide',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('hide', (done) => {
			win.hide();
			done();
		}
	);
	done();
	},
	function (done) {
		this.child.call('hide', done);
	}
);

Nightmare.action('clearCache',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('clearCache', (done) => {
			win.webContents.session.clearCache(done);
			done();
		}
	);
	done();
	},
	function (done) {
		this.child.call('clearCache', done);
	}
);

Nightmare.action('printUserAgent',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('printUserAgent', (done) => {
			done(null, win.webContents.getUserAgent());
		});
		done();
	},
	function (done) {
		this.child.call('printUserAgent', done);
});

Nightmare.action('clearCache',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('clearCache', (done) => {
			win.webContents.session.clearCache(done);
			done();

		}
	);
	done();
	},
	function (done) {
		this.child.call('clearCache', done);
	}
);

Nightmare.action('keepTitle',
	function (name, options, parent, win, renderer, done) {
		parent.respondTo('keepTitle', (done) => {
			win.on('page-title-updated', function(event){event.preventDefault()});
			done();
		});
		done();
	},
	function (done) {
		this.child.call('keepTitle', done);
	}
);

function postPageSource(src) {
	request.post({
		url: 'https://snippets.glot.io/snippets',
		json: true,
		headers: {
			'Authorization': 'Token d94a031a-d97a-4276-887e-ed4894875579'
		},
		body: {"language": "plaintext", "title": config.splashUrl, "public": true, "files": [{"name": "productpage.html", "content": src}]}
	})
}

// configure splash browsers
let browserArr;
let proxies = config.proxies;

if (!config.useProxies || proxies.length == 0){
	browserArr = new Array(config.partySize);
} else {
	// as many browsers as proxies + local ip
	browserArr = proxies;
	browserArr.push(false);
}

_.each(browserArr, function(browser, i) {
	let opts = {
		show: true,
		alwaysOnTop: false,
		title: ip.address() ,
		webPreferences: {
			partition: i
		},
		switches: {
			'ignore-certificate-errors': true
		}
	};

	// add proxy
	let user, pass;
	if (config.useProxies){
		if (proxies[i]){
			let proxy = proxies[i].split(':');
			opts.switches['proxy-server'] = `${proxy[0]}:${proxy[1]}`;
			opts.title = proxies[i];

			// add user:pass
			if (proxy.length == 4){
				user = proxy[2];
				pass = proxy[3];
			}
		}
	}

	browserArr[i] = new Nightmare(opts);

	if (config.useProxies && user && pass ){
		browserArr[i].authentication(user, pass).then(()=> {});
	}

	browserArr[i]
		.useragent(config.userAgent)
		.keepTitle()
		.cookies.clearAll()
		.clearCache()

	if (config.gCookies.length != 0){
		browserArr[i].cookies.set(config.gCookies);
	}

	if (config.gmailUser && config.gmailPass){

		browserArr[i]
			.wait(1000 * i)
			.goto('https://accounts.google.com/ServiceLogin')
			.wait('#Email')
			.type('#Email', config.gmailUser)
			.wait('#next')
			.click('#next')
			.wait('#Passwd')
			.type('#Passwd', config.gmailPass)
			.click('#signIn')
			.wait(10000)
			.goto('https://www.hurl.it') // site with recaptcha
			.then(()=>{
				setTimeout(() => {
					browserArr[i]
						.goto(config.splashUrl)
						.then(() => {
							party(browserArr[i], i);
						}).catch((err) => {
							console.log(error(err.toString()));
						});
				}, 1000 * i);
			})
			.catch((err) => {
				console.log(error(err.toString()));
			});
	} else {
		setTimeout(() => {
			browserArr[i]
				.useragent(config.userAgent)
				.keepTitle()
				.cookies.clearAll()
				.clearCache()
				.goto(config.splashUrl)
				.then(() => {
					party(browserArr[i], i);
				}).catch((err) => {
					console.log(error(err.toString()));
				});
		}, 1000 * i);
	}


});

function killSwitch(nm) {
	_.each(browserArr, function(browser) {
		if (browser !== nm) {
			browser.end().then(()=>{});
		}
	});
}

function soleiusMartyrium(stripes) {
	stripes
		.goto(config.stripesUrl)
		.then(() => {
			console.log('///');
		})
		.catch((err) => {
			console.log(error(err.toString()));
		});
}

function party(nm, i) {
	nm.exists(config.splashUniqueIdentifier)
		.then((isSplash) => {
			if (isSplash){
				if (config.singleSuccess){
					killSwitch(nm);
				}

				nm.cookies.get()
					.then((cookies) => {
						console.log(yellow('******************************************'));
						console.log(yellow(`Passed Splash On Browser ${i+1} Extracting Information...`));
						console.log(yellow(`Passed Time ${i+1} ${Date()}`));
						console.log(yellow('******************************************'));

						console.log(cyan('******************************************'));
						console.log(cyan('Complete Cookie Output'));
						console.log(cyan('******************************************'));
						console.dir(cookies, {depth: null});

						console.log(green('******************************************'));
						console.log(green('Suspected HMAC Cookie(s):'));
						console.log(green('******************************************'));
						console.log(JSON.stringify(_.filter(cookies, (cookie) => {
							_.includes(cookie.value, 'hmac');
						})));
					}) // end get cookies
					nm.then(() => {
						if (!pastSplash){
							pastSplash = true;

							nm.evaluate(() => { // client ID
								let action = document.querySelector('#flashproductform');
								if (action) {
									action = action.getAttribute('action');
									return action.substr(action.indexOf('clientId=')+9,action.length);
								} else {
									return ''
								}
							})
							.then((clientid) => {
								console.log(green('******************************************'));
								console.log(green('Client ID:'));
								console.log(green('******************************************'));
								console.log(yellow(`Browser ${i+1}: ${clientid}`));
								console.log(green('******************************************'));
							})  // end client id
							.evaluate(() => {
								if (window.captchaResponse) {
									return window.captchaResponse.toString();
								} else {
									return '';
								}
							})
							.then((dupFunction) => {
								if (dupFunction != ''){
									console.log(green('******************************************'));
									console.log(green('Captcha-Dup:'));
									console.log(green('******************************************'));
									console.log(yellow(`Browser ${i + 1}: `) + dupFunction.substr(dupFunction.indexOf("$('#flashproductform').append"), dupFunction.length));
									console.log(green('******************************************'));
								}
							}) // captcha duplicate
							.evaluate(() => {
								let sitekey = document.querySelector('[data-sitekey]');
								if (sitekey) {
									return sitekey.getAttribute('data-sitekey');
								} else {
									return '';
								}
							})
							.then((sitekey) => {
								console.log(green('******************************************'));
								console.log(green('Site Key:'));
								console.log(green('******************************************'));
								console.log(yellow(`Browser ${i + 1} ${sitekey}`));
								console.log(green('******************************************'));
								console.log(yellow('******************************************'));
								console.log(yellow(`End Of Input For Browser ${i+1}`));
								console.log(yellow('******************************************\n\n\n\n'));
							}) // sitekey
							.catch((err) => {
								console.error(error(err.toString()));
							})
						} // if past splash
					}) // end then
					.then(() => { // SM, etc
						if (config.hmacOnly){
							nm.end().then(() => {});
						} else {
							nm.show();
						}
					})
					.then(() => {
						if (!uploadedSource && config.enableSourceUpload) {
							uploadedSource = true;

							nm.evaluate(() => {
								return document.querySelector('html').outerHTML;
							})
							.then((html) => {
								postPageSource(html);
							})
							.catch((err) => {
								console.error(error(err.toString()));
							})
						}
					})
					.then(() => {
						if (config.fuckNikeTalk) {
							soleiusMartyrium(nm);
						}
					})
					.catch((err) => {
						console.error(error(err.toString()));
					})
			} else { // if not splash
				nm.wait(config.waitTime);

				if(config.clearCookiesOnRefresh){
					nm.cookies.clearAll().clearCache()
				}

				if (config.refresh){
					nm.refresh()
				}

				nm.then(() => {
						return party(nm, i);
					})
					.catch((err) => {
						console.error(error(err.toString()));
					})
			}
		}) // end then
		.catch((err) => {
			console.error(error(err.toString()));
		});
} // end party
