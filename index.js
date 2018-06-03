const path = require("path")
const spirit = require("spirit").node
const router = require("spirit-router")
const http = require("http")
const rp = require("request-promise")
const memoizee = require("memoizee")

const getJson = (uri) => rp({uri, json:true})
//const Promise = require("bluebird")
//const fs = Promise.promisifyAll(require("fs"), { suffix: "Promise" });
const cfg = {
		port:7650
	}
const cardCache = {}
const app = router.define([
		router.get("/", [], fileResponse),
		router.get("/static/:filename", ["filename"], fileResponse),
		router.get("/api/search/test",["query"],middle(({q})=>(q.split('')))),
		router.get("/api/search/card",["query"],middle( async ({query}) =>
				(await getJson("https://api.scryfall.com/cards/autocomplete?q="+query)).data
			)),
		//router.get("/api/search/deck",["query"],middle(deckSearch)),
		router.get("/api/details/card",["query"],middle(async({id,valuation}) =>
				await getJson(
						"https://api.scryfall.com/cards/search"
						+'?q=!"'+id+'"'
						+"&sort="+(valuation=="online"?"tix":"usd")
					).data
			)),
		router.get("/api/details/deck/tappedout",  ["id","valuation"],middle(id=>"TODO")),
		router.get("/api/details/deck/mtggoldfish",["id"],middle(({id})=>"TODO")),
		router.get("/api/details/deck/manastack",  ["id"],middle(({id})=>"TODO")),
		router.get("/api/details/test",["query"],middle(({id, valuation})=>({
				icon: "about:blank",
				name: id+" name",
				value: getValue({cards: ["20x Mountain","40x Lightning Bolt"], valuation})
			}))),
		router.get("*",middle(()=>{throw {status:400,body:"Unsupported URL Pattern"}}))
		// router.get("/t/:slug", ["slug"], getTappedOut)
		// router.get("/g/:slug", [slug], getGoldfish)
		// router.get("/s/:slug", [slug], getManastack)
		// router.get("/c/:name", [cardName], getCard)
	])

const server = http.createServer(spirit.adapter(app))
server.listen(cfg.port, ()=>console.log("https://localhost:"+cfg.port))

// with spirit.node.file_response
async function fileResponse(filename){
		try{
				return spirit.fileResponse(__dirname +(filename
						?"/static/"+filename
						:"/static/index.html"
					))
			}catch(e){
				console.error(e);
				return {status:404,body:"Not found"}
			}
		//TODO confirm ../ in url doesn't expose parent dir's
	}
async function getValue({cardsLines,valuation}){
		const cacheLimit = Date.now()
		const cards = cardsLines
				.map(str => str.match(/^([0-9]+) ?x? ?(.*$)/))
				.map(matches => ({name:matches[2], qty:0+(matches[1]||"1")}))
				.reduce((idx,cardLine) =>({...idx, [card.name]:{
						name:cardLine.name,
						qty: cardLine.qty+((idx[cardLine.name]||{}).qty||0),
						...cardCache[card.name]
					}}),{})
		const missingCardData =
				Object.entries(cards)
				.filter(([name,data])=>!data.retrieved || data.retrieved<cacheLimit)
				//CONTINUE HERE
		const cardData = rp("https://api.scryfall.com/cards/search?order=usd&q="

	}

async function cardDetail({id,valuation}){
		//https://scryfall.com/docs/api/cards/named

	}


function peek(x){console.log(x);return x}
//Middleware to memoize, JSONify and HTTPify a "plain" function
function middle(fn){
		"use strict";
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
						maxAge: 24 * 60 * 60 //24 hours
					}
			)
		return async function(...args){
				console.log(args)
				try{
					return peek(await mfn(...args))
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
