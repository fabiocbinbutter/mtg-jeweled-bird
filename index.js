const path = require("path")
const spirit = require("spirit").node
const router = require("spirit-router")
const http = require("http")
const rp = require("request-promise")
//const Promise = require("bluebird")
//const fs = Promise.promisifyAll(require("fs"), { suffix: "Promise" });
const cfg = {
		port:7650
	}

const app = router.define([
		router.get("/", [], fileResponse),
		router.get("/static/:filename", ["filename"], fileResponse),
		router.get("/api/card/search",["query"],cardSearch),
		router.get("/api/card/detail",["name","valuation"],cardDetail),
		router.get("/api/deck",["query","sources"],deckSearch)
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
async function cardSearch(query){
		//https://scryfall.com/docs/api/cards/autocomplete
		const result = await rp("https://api.scryfall.com/cards/autocomplete?q="+query)
		return result.data
	}

async function cardDetail(name,valuation){
		//https://scryfall.com/docs/api/cards/named
		const result = await rp("https://api.scryfall.com/cards/search"
				+'?q=!"'+name+'"'
				+"&sort="+(valuation=="online"?"tix":"usd")
			)
		return result.data
	}
async function deckSearch(query,sources){

	}
