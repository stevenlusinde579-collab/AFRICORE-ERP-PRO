import express from "express";
import { askGemini } from "../ai/gemini.service.js";


const router = express.Router();



router.get("/test-gemini", async(req,res)=>{


try{


const result = await askGemini(

"Explain what an examination paper is in one sentence."

);



res.json({

success:true,

response:result

});




}catch(error){


res.status(500).json({

success:false,

error:error.message

});


}



});



export default router;