const fs = require("fs")
const path = require("path")
const compression = require("compression")
const express = require("express")
const app = express()

var owncloud = require('js-owncloud-client');
const bodyParser = require('body-parser')
const cors = require('cors')
const morgan = require('morgan')
var multer  = require('multer')
//var upload = multer({ dest: 'uploads/' })
//var upload = multer({ dest: 'uploads/',
 // filename: file.originalname })
 var storage = multer.diskStorage({
	destination: function (req, file, cb) {
	  cb(null, './uploads') //Destination folder
	},
	filename: function (req, file, cb) {
	  cb(null, file.originalname) //File name after saving
	}
  })

  var upload = multer({ storage: storage })

var oc = new owncloud('localhost');

//const fileUpload = require('express-fileupload');
//app.use(fileUpload());

app.use(morgan('combined'))
app.use(bodyParser.urlencoded({ extended: true }));

app.use(bodyParser.json())
app.use(cors())

const favicon = require('serve-favicon')

const resolve = (file) => path.resolve(__dirname, file)

const config = require("./config")
const isProduction = config.isProduction

const template = fs.readFileSync(resolve("./src/index.template.html"), "utf-8")

const createRenderer = (bundle, options) => {
	// https://github.com/vuejs/vue/blob/dev/packages/vue-server-renderer/README.md#why-use-bundlerenderer
	return require("vue-server-renderer").createBundleRenderer(bundle, Object.assign(options, {
		template,
		cache: require("lru-cache")({
			max: 1000,
			maxAge: 1000 * 60 * 15
		}),
		// this is only needed when vue-server-renderer is npm-linked
		basedir: resolve("./dist"),
		// recommended for performance
		runInNewContext: false
	}))
}

const serve = (path, cache) => express.static(resolve(path), {
	maxAge: cache && isProduction ? 60 * 60 * 24 * 30 : 0
})

let renderer
let readyPromise
if (isProduction) {
	// In production: create server renderer using built server bundle.
	// The server bundle is generated by vue-ssr-webpack-plugin.
	const bundle = require("./dist/vue-ssr-server-bundle.json")
	// The client manifests are optional, but it allows the renderer
	// to automatically infer preload/prefetch links and directly add <script>
	// tags for any async chunks used during render, avoiding waterfall requests.
	const clientManifest = require("./dist/vue-ssr-client-manifest.json")
	renderer = createRenderer(bundle, {
		clientManifest
	})
	readyPromise = Promise.resolve()
} else {
	// In development: setup the dev server with watch and hot-reload,
	// and create a new renderer on bundle / index template update.
	readyPromise = require("./build/setup-dev-server")(app, (bundle, options) => {
		renderer = createRenderer(bundle, options)
	})
}

const render = (req, res, context) => {
	const s = Date.now()

	console.log(`Rendering: ${req.url}`)

	res.setHeader("Content-Type", "text/html")

	const errorHandler = (err) => {
		// TODO: Render Error Page
		console.error(`Fatal error when rendering : ${req.url}`)
		console.error(err)

		res.status(500)
		res.end(`500 | Fatal error: ${err}`)

		console.log(`Whole request: ${Date.now() - s}ms`)
	}

	renderer.renderToString(context, (err, html) => {
		if (err) return errorHandler(err)

		res.status(context.meta.httpStatusCode || 200)
		res.end(html)

		console.log(`Whole request: ${Date.now() - s}ms`)
	})
}

app.use(compression({ threshold: 0 }))
app.use(favicon('./static/favicon.png'))

app.use("/dist", serve("./dist", true))
app.use("/static", serve("./static", true))
app.use("/service-worker.js", serve("./dist/service-worker.js"))

app.get("*", (req, res) => {
	const context = {
		url: req.url
	}
	isProduction ?
		render(req, res, context) :
		readyPromise.then(() => render(req, res, context))
})
console.log("HHHUUUUURRRYYYAAAA")
const keyFilename="./uploads/comment-c7d54-firebase-adminsdk-hveft-d0f9cf0854.json"; //replace this with api key file
const projectId = "comment-c7d54" //replace with your project id
const bucketName = `${projectId}.appspot.com`;


const gcs = require('@google-cloud/storage')({
    projectId,
    keyFilename
});

const bucket = gcs.bucket(bucketName);

//const filePath = `./ya.mp4`;
//const uploadTo = `subfolder/ya.mp4`;
//const fileMime = mime.lookup(filePath);



app.post('/login', (req, res)=> {
	oc.login(req.body.user, req.body.pass).then(status => {
    res.send("loged")
}).catch(error => {
    res.send("error")
});
})

app.post('/list',(req,res)=>{
	oc.files.list(req.body.path).then(files => {
    res.send(files)
}).catch(error => {
   res.send(error)
});
})

app.post('/brodownload',(req,res)=>{
	let k=`./${req.body.name}`
	console.log(req.body.path,"req",k)
	oc.files.getFile(req.body.path,k).then(rest=>{
		let h=`subfolder/${req.body.name}`
		bucket.upload(k,{
			destination:h,
			public:true,
			metadata: {contentType:`./${req.body.name}`,cacheControl: "public, max-age=300"}
		}, function(err, file) {
			if(err)
			{
				console.log(err);
				return;
			}
			console.log(createPublicFileURL(h));
			res.send("mohit")
		});
		function createPublicFileURL(storageName) {
			return `http://storage.googleapis.com/${bucketName}/${encodeURIComponent(storageName)}`;
		
		}
		//res.send("mohit")
	})

})
const port = config.server.port
let server = app.listen(port, () => {
	console.log(`Server started at localhost:${port}`)
})

module.exports = {
	ready: readyPromise,
	close: () => {
		server.close()
	}
}
