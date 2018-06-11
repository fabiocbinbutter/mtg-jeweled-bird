const path = require("path")
const spirit = require("spirit").node
const router = require("spirit-router")
const route = (verb,path,...fns) => router.wrap(router.method(verb,path,fns.slice(-1)[0]),fns.slice(0,-1))
const http = require("http")
const rp = require("request-promise")
const memoizee = require("memoizee")
const getJson = (uri) => rp({uri, json:true})
//const Promise = require("bluebird")
//const fs = Promise.promisifyAll(require("fs"), { suffix: "Promise" });
const cfg = {
		port:7650
	}
const cardCache = new Map();
/*
const app = router.define([
		router.get("/", [], fileResponse),
		router.get("/static/:filename", ["filename"], fileResponse),
		route("get","/api/search/test",
				listen => async req => await listen(req.query.q),
				q=>peek(q).split('')
				//middle(req=>[req.query.q],q=>q.split(''))
			),
		router.get("/api/search/card",middle(
				req=>[req.query.q],
				async q =>(await getJson("https://api.scryfall.com/cards/autocomplete?q="+q)).data
			)),
		//router.get("/api/search/deck",["query"],middle(deckSearch)),
		router.get("/api/details/card",["query"],middle(async ({id,valuation}) =>
				(await getValue({lines:[id],valuation}))
			)),
		router.get("/api/details/deck/tappedout",  ["id","valuation"],middle(id=>"TODO")),
		router.get("/api/details/deck/mtggoldfish",["id"],middle(({id})=>"TODO")),
		router.get("/api/details/deck/manastack",  ["id"],middle(({id})=>"TODO")),
		router.get("/api/details/test",["query"],middle(async ({id, valuation})=>({
				icon: "about:blank",
				name: id+" name",
				value: await getValue({lines: ["20x Mountain","40x Lightning Bolt"], valuation})
			}))),
		router.get("*",middle(()=>{throw {status:400,body:"Unsupported URL Pattern"}}))
		// router.get("/t/:slug", ["slug"], getTappedOut)
		// router.get("/g/:slug", [slug], getGoldfish)
		// router.get("/s/:slug", [slug], getManastack)
		// router.get("/c/:name", [cardName], getCard)
	])*/
//var app = (request)=>{console.log(request); return {status:200, headers:{"Content-Type":"text/plain"},body:"Hi!"}}
const app = which(
		//way(r`/`, ()=>({status:200,headers:{"Content-Type":"text/plain"},body:"Hi :)"}))
		way(r`/`, fileResponse)
	)
		// router.get("/static/:filename", ["filename"], fileResponse),
		// route("get","/api/search/test",
		// 		listen => async req => await listen(req.query.q),
		// 		q=>peek(q).split('')
		// 		//middle(req=>[req.query.q],q=>q.split(''))
		// 	),
		// router.get("/api/search/card",middle(
		// 		req=>[req.query.q],
		// 		async q =>(await getJson("https://api.scryfall.com/cards/autocomplete?q="+q)).data
		// 	)),
		// //router.get("/api/search/deck",["query"],middle(deckSearch)),
		// router.get("/api/details/card",["query"],middle(async ({id,valuation}) =>
		// 		(await getValue({lines:[id],valuation}))
		// 	)),
		// router.get("/api/details/deck/tappedout",  ["id","valuation"],middle(id=>"TODO")),
		// router.get("/api/details/deck/mtggoldfish",["id"],middle(({id})=>"TODO")),
		// router.get("/api/details/deck/manastack",  ["id"],middle(({id})=>"TODO")),
		// router.get("/api/details/test",["query"],middle(async ({id, valuation})=>({
		// 		icon: "about:blank",
		// 		name: id+" name",
		// 		value: await getValue({lines: ["20x Mountain","40x Lightning Bolt"], valuation})
		// 	}))),
		// router.get("*",middle(()=>{throw {status:400,body:"Unsupported URL Pattern"}}))

const server = http.createServer(spirit.adapter(app))

server.listen(cfg.port, ()=>console.log("https://localhost:"+cfg.port))

// with spirit.node.file_response
//async function fileResponse(filename){ //non spirit-guide way
async function fileResponse(req){
		try{
				return spirit.fileResponse(__dirname +(req.params.filename
						?"/static/"+req.params.filename
						:"/static/index.html"
					))
			}catch(e){
				console.error(e);
				return {status:404,body:"Not found"}
			}
		//TODO confirm ../ in url doesn't expose parent dir's
	}
async function getValue({lines,valuation}){
		const val = valuation=="tix"?"tix":"usd";
		const now = Date.now()
		const earliestAcceptedCache = now - 3 * 24 * 60 * 60 //3 days
		const parsedLines = lines
				.map(str => str.match(/^(([0-9]+) ?x? +)?(.*)$/))
				.map(matches => ({
						line: matches[0],
						name: matches[3],
						qty:  1*(matches[3]?(matches[2]||"1"):"0")
					}))
		const cards = parsedLines.filter(c=>c.name).map(c=>c.name)
		const cardsMissingData = cards.filter(name=>
					((cardCache.get(val+name)||{}).updated||0)>earliestAcceptedCache
				)
		if(cardsMissingData.length){
				if(cardsMissingData.length>175){throw "Card list is longer than allowed by Scryfall API."}
				(await rp(
						"https://api.scryfall.com/cards/search?order="+val+"&q="
						+encodeURIComponent(cardsMissingData.map(name=>'!"'+name+'"').join(" or "))
					))
				.data
				.map(({name, image_uris,usd,tix})=>({
						name,
						[val]:val=="tix"?tix:usd,
						img: image_uris.small,
						updated: now
					}))
				.forEach(card=>cardCache.set([val+card.name,card]))
			}
		const pricedLines = parsedLines.map(line=>{
				var card = line.name?cardCache.get(val+line.name)||{val:"err"}:{}
				return {
						...line,
						val,
						...card,
						...(line.qty && card[val] ? {[val+"_x_qty"]:line.qty * card[val]}:{}),
						//...(line.qty && card.tix ? {tix_x_qty:line.qty * card.tix}:{})
					}
			})
		const totalPrice = pricedLines.reduce((total,line) =>
				total + (line[val+"_x_qty"]||0)
			,0)

		const totalQty = pricedLines.reduce((total,line) =>
				total + (line.qty||0)
			,0)
		return {
				["total_"+val]:totalPrice,
				["avg_"+val]:totalPrice/totalQty,
				lines:pricedLines
			}
	}

async function cardDetail({id,valuation}){
		//https://scryfall.com/docs/api/cards/named

	}


function peek(x){console.log(x);return x}
//Middleware to memoize, JSONify and HTTPify a "plain" function
function middle(extract,fn){
		const mfn = memoizee(
			 	async function(...args){
					console.log("Uncached")
					return {
						status:200,
						headers:{"Content-Type": "application/json; charset=utf-8"},
						body:JSON.stringify(await fn(...args))
					}},
				{
						max: 5000, //Memoize LRU cache's max item count
						maxAge: 24 * 60 * 60, //24 hours
						normalizer: (...args) => JSON.stringify(args)
					}
			)
		return async function(req){
				var logicalArg = extract(req)
				console.log(logicalArg)
				try{
					return peek(await mfn(logicalArg))
				}
				catch(e){
						console.error(e)
						try {
							return {
									status: e.status || 500,
									headers:{"Content-Type": "application/json; charset=utf-8"},
									body:JSON.stringify(e.body || "Error. See logs for details.")
								}
							}catch(e){
								return{
										status: e.status || 500,
										headers:{"Content-Type": "application/json; charset=utf-8"},
										body:'"Error. See logs for details."'
									}
							}
					}
			}
	}



function which(...fns){
		return async req => {
				for(fn of fns){
						let maybeNewFn = await fn(req)
						if(maybeNewFn !== undefined){return maybeNewFn}
					}
			}
	}
function way(...fns){
		return async req => {
				//console.log(1,...fns)
				var first = fns.shift()
				//console.log(2,...fns)
				return fns.length
						? await first(way(...fns))(req)
						: await first(req)
			}
	}

function r(str){//httpRequestMatch(str){
		if(str instanceof Array){str=str[0]} //Template literal invocation
		if(typeof str != "string"){throw "Expected route definition to be a string"}
		var matches = str.match(
				/^((GET|POST|PUT|PATCH|HEAD|DEL|OPTIONS|\*) )?(((https?):)?)?(\/\/([^:\/#?]+))?(\/)?$/
			)
		var m = {
				verb: matches[2],
				protocol: matches[5],
				domain: matches[7],
				//I could add port, but it would be pointless since node only listens on one port
				path:matches[8]
			}
		var required = {
				verb: m.verb != '' && m.verb != '*' ? m.verb : undefined,
				protocol: m.protocol,
				domain: m.domain && m.domain.split(".").reverse(),
				path: m.path && m.path.split("/").reverse()
			}
		if(required.domain && required.domain.includes("**") && required.domain.indexOf("**") != required.domain.length - 1){
				throw "httpRequestMatch only supports ** at the head of the domain pattern"
			}
		if(required.path && required.path.includes("**") && required.path.indexOf("**") != required.path.length - 1){
				throw "httpRequestMatch only supports ** at the end of the path pattern"
			}

		return handler => async request => {
				console.log(request)
				var capture = {}
				if(required.verb && reqest.verb != required.verb){return}
				if(required.protocol && request.protocol != required.protocol){return}
				if(required.domain){
						let offset = -1, parts = request.host.split(".").reverse()
						for (let requiredPart of required.domain){
								offset++;
								if(parts[offset] == requiredPart){continue}
								if(requiredPart == "*"){continue}
								if(requiredPart[0] == ":"){
										capture[requiredPart.slice(1)] = parts[offset]
										continue
									}
								if(requiredPart == "**"){break}
								return
							}
					}
				if(required.path){
						let parts = request.path.split("/").reverse()
						let offset = -1
						for (let requiredPart of required.path){
								offset++;
								if(parts[offset] == requiredPart){continue}
								if(requiredPart == "*"){continue}
								if(requiredPart[0] == ":"){
										capture[requiredPart.slice(1)] = parts[offset]
										continue
									}
								if(requiredPart == "**"){break}
								return
							}
					}
				return await handler({
						...request,
						params:{
								...request.params,
								...capture
							}
					})
			}
	}
function objToJsonResp(o){
		return {
				status: 200,
				headers: {"Content-Type":"application/json"},
				body: JSON.stringify(o)
			}
	}
function strToRedirectResp(str){
		return {
				status: 302,
				headers: {Location:str}
			}
	}
function tryTo(fn){return async req =>{
		try{
				await fn(req)
			}catch(e){
				return {
						status: 500,
						headers: {"Content-Type":"application/json"},
						body: JSON.stringify({error:"Internal Error"})
					}
			}
	}}
