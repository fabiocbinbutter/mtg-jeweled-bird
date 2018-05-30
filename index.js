const path = require("path")
const spirit = require("spirit").node
const router = require("spirit-router")
const http = require("http")
const rp = require("request-promise")
const getJson = (uri) => rp({uri, json:true})
//const Promise = require("bluebird")
//const fs = Promise.promisifyAll(require("fs"), { suffix: "Promise" });
const cfg = {
		port:7650
	}

const app = router.define([
		router.get("/", [], fileResponse),
		router.get("/static/:filename", ["filename"], fileResponse),
		router.get("/api/card/search",["query"],json(cardSearch)),
		router.get("/api/card/detail",["name","valuation"],json(cardDetail)),
		router.get("/api/deck/search",["query","sources"],json(deckSearch)),
		router.get("/api/test/search",["query"],json(({query})=>(query.split(''	)))),
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
async function cardSearch({query}){
		//https://scryfall.com/docs/api/cards/autocomplete
		const result = await getJson("https://api.scryfall.com/cards/autocomplete?q="+query)
		return result.data
	}

async function cardDetail({name,valuation}){
		//https://scryfall.com/docs/api/cards/named
		const result = await getJson("https://api.scryfall.com/cards/search"
				+'?q=!"'+name+'"'
				+"&sort="+(valuation=="online"?"tix":"usd")
			)
		return result.data
	}
async function deckSearch({query,sources}){

	}
function json(fn){
		return async function(...args){
				try{
						return {
								status:200,
								headers:{"Content-Type": "application/json; charset=utf-8"},
								body:JSON.stringify(await fn(...args))
							}
					}catch(e){
						console.log(e)
						return {
								status: e.status || 500,
								headers:{"Content-Type": "application/json; charset=utf-8"},
								body:JSON.stringify({error: e.message || "Error. See logs for details."})
							}
					}
			}
	}
