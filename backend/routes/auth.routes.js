import express from "express";

const router = express.Router();


router.post("/register",(req,res)=>{

    const {name,email,password}=req.body;


    res.json({

        success:true,

        message:"Register API Working",

        user:{
            name,
            email
        }

    });


});


export default router;