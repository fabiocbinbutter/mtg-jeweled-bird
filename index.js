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

const app = router.define([
		router.get("/", [], fileResponse),
		router.get("/static/:filename", ["filename"], fileResponse),
		router.get("/api/card/search",["query"],middle( async query =>
				(await getJson("https://api.scryfall.com/cards/autocomplete?q="+query)).data
			)),
		router.get("/api/card/detail",["id","valuation"],middle(cardDetail)),
		router.get("/api/deck/search",["query","sources"],middle(deckSearch)),
		router.get("/api/test/search",["query"],middle(({query})=>(query.split('')))),
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
// async function cardSearch({query}){
// 		//https://scryfall.com/docs/api/cards/autocomplete
// 		const result = await getJson("https://api.scryfall.com/cards/autocomplete?q="+query)
// 		return result.data
// 	}

async function cardDetail({id,valuation}){
		//https://scryfall.com/docs/api/cards/named
		const result = await getJson("https://api.scryfall.com/cards/search"
				+'?q=!"'+id+'"'
				+"&sort="+(valuation=="online"?"tix":"usd")
			)
		return result.data
	}
async function deckSearch({query,sources}){

	}

function peek(x){console.log(x);return x}
//Middleware to memoize, JSONify and HTTPify a "plain" function
function middle(fn){
		"use strict";
		const mfn = memoizee(
			 	async function(...args){
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
				try{
					return peek(await mfn(...args))
				}
				catch(e){
						console.error(e)
						try {
							return {
									status: e.status || 500,
									headers:{"Content-Type": "application/json; charset=utf-8"},
									body:JSON.stringify({error: e.message || "Error. See logs for details."})
								}
							}catch(e){
								return{
										status: e.status || 500,
										headers:{"Content-Type": "application/json; charset=utf-8"},
										body:"Error. See logs for details."
									}
							}
					}
			}
	}
