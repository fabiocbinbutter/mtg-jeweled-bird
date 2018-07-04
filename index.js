const path = require("path")
const spirit = require("spirit").node
const {r,which,way} = require("../spirit-guide")
//const router = require("spirit-router")
//const route = (verb,path,...fns) => router.wrap(router.method(verb,path,fns.slice(-1)[0]),fns.slice(0,-1))
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
const app = which(
	way(r`GET /`, req=>fileResponse()),
	way(r`GET /static/:filename`,
		caught({status: 404, body:"File not found"}),
		req=>fileResponse(req.params.filename)),
	way(r`GET /api/**`,
		caught({status:500}),
		jsonResp,
		which(
			way(r`.../search/test`, q, memoize, query => query.split('') ),
			way(r`.../search/card`, q, memoize, searchCard),
			way(r`.../search/omni`, q, query =>
				Promise.all([
					memoize(searchCard)
				])
			),
			// "Details" combine fetching both a list to view, and a valuation
			way(r`.../details/test`, req => ({list:[{img:"",name:req.query.q,qty:1}],val:""})),
			way(r`.../details/card`, q, memoize, getValue),
			req => {throw {status:400,message:"Invalid API route"}}
			)
		),
	req => ({status:404,headers:{"Content-Type":"text/html"},body:"Not found"})
	)
function q(pass){return async (req) => await pass(req.query.q)}
async function searchCard(q) {return peek(await getJson("https://api.scryfall.com/cards/autocomplete?q="+encodeURIComponent(q))).data}

// const app = router.define([

// 		//router.get("/api/search/deck",["query"],middle(deckSearch)),
// 		router.get("/api/details/card",["query"],middle(async ({id,valuation}) =>
// 				(await getValue({lines:[id],valuation}))
// 			)),
// 		router.get("/api/details/deck/tappedout",  ["id","valuation"],middle(id=>"TODO")),
// 		router.get("/api/details/deck/mtggoldfish",["id"],middle(({id})=>"TODO")),
// 		router.get("/api/details/deck/manastack",  ["id"],middle(({id})=>"TODO")),
// 		router.get("/api/details/test",["query"],middle(async ({id, valuation})=>({
// 				icon: "about:blank",
// 				name: id+" name",
// 				value: await getValue({lines: ["20x Mountain","40x Lightning Bolt"], valuation})
// 			}))),
// 		router.get("*",middle(()=>{throw {status:400,body:"Unsupported URL Pattern"}}))
		// router.get("/t/:slug", ["slug"], getTappedOut)
		// router.get("/g/:slug", [slug], getGoldfish)
		// router.get("/s/:slug", [slug], getManastack)
		// router.get("/c/:name", [cardName], getCard)
//	])
//var app = (request)=>{console.log(request); return {status:200, headers:{"Content-Type":"text/plain"},body:"Hi!"}}


const server = http.createServer(spirit.adapter(app))

server.listen(cfg.port, ()=>console.log("http://localhost:"+cfg.port))

// with spirit.node.file_response
//async function fileResponse(filename){ //non spirit-guide way
async function fileResponse(filename){
		try{
				return spirit.fileResponse(__dirname + (
						filename
						?"/static/"+filename
						:"/static/index.html"
					))
			}catch(e){
				console.error(e);
				return {status:404,body:"Not found"}
			}
		//TODO confirm ../ in url doesn't expose parent dir's
	}
async function getValue(list){
		//const val = valuation=="tix"?"tix":"usd";
		const now = Date.now()
		const earliestAcceptedCache = now - 3 * 24 * 60 * 60 //3 days
		const lines = list instanceof Array ? list : list.split(/[/r/n]+/)
				.map(str => str.match(/^(([0-9]+) ?x? +)?(.*)$/))
				.map(matches => ({
						//line: matches[0],
						name: matches[3] && matches[3].trim,
						qty:  1*(matches[3]?(matches[2]||"1"):"0")
					}))
		const linesMissingData = lines.filter(l=>
					//l.name && l.name.trim() && //Uncomment if caching "" as isCard:false is not working well
					((cardCache.get(l.name)||{}).updated||0)>earliestAcceptedCache
				)
		if(linesMissingData.length){
				if(linesMissingData.length>175){throw "Card list is longer than allowed by Scryfall API (175)"}
				const cardDataByName = (await rp(
						"https://api.scryfall.com/cards/search?order=usd&q="
						+encodeURIComponent(
								linesMissingData
								.map(line => '!"'+line.name+'"')
								.filter(unique)
								.join(" or ")
							)
					))
				.data
				.map(({name,usd,tix,image_uris})=>({
						name, usd, tix,
						img: image_uris.small,
						updated: now,
						isCard:true
					}))
				.reduce((obj,c)=>({...obj, [c.name]:c}),{})
			}

		const enrichedLines = lines.map(line=>({
				...line,
				isCard:false,
				...(cardCache.get(line.name) || {}),
				...(cardDataByName && cardDataByName[line.name] || {})
				//...(line.qty && card.tix ? {tix_x_qty:line.qty * card.tix}:{})
			}))
		enrichedLines.forEach(({name,isCard,img,usd,tix,updated}) =>
				cardCache.set([name,{name,isCard,img,usd,tix,updated}])
			)
		const totals = enrichesLines.reduce((totals,line) => ({
				cards: totals.cards + line.isCard?line.qty:0,
				usd: totals.usd + line.qty * line.usd||0,
				tix: totals.tix + line.qty * line.tix||0
			}),{tix:0,usd:0,cards:0})
		return {
				totals,
				lines:enrichedLines
			}
	}

async function cardDetail({id,valuation}){
		//https://scryfall.com/docs/api/cards/named

	}


function peek(x){console.log(x);return x}
//Middleware to memoize, JSONify and HTTPify a "plain" function

function memoize(fn){
		return memoizee(
			 	async function(...args){
					console.log("Uncached: ",...args)
					return await fn(...args)
					},
				{
						max: 5000, //Memoize LRU cache's max item count
						maxAge: 24 * 60 * 60, //24 hours
						//normalizer: (...args) => JSON.stringify(args)
					}
			)
	}



function jsonResp(fn){return async req =>{
		try{
				return {
						status: 200,
						headers: {"Content-Type":"application/json"},
						body: JSON.stringify(await fn(req))
					}
			}catch(e){
				console.log(e)
				return {
						status: e.status || 500,
						headers: {"Content-Type":"application/json"},
						body: JSON.stringify({error:e.error && e.error.message || e.message || "Internal Error"})
					}
			}
	}}
function caught(settings){return fn => async req=>{
		try{return await fn(req)}
		catch(e){return {
				status: settings.status || e.status || 500,
				headers: {
					"Content-Type":"text/plain",
					...(e && e.headers),
					...settings.headers
				},
				body: settings.body || e.body
			}}
	}}
