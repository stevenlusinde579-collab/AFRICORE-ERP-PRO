import express from "express";
import { supabase } from "../config/supabase.js";


const router = express.Router();



// SIMPLE TEST

router.get("/test",(req,res)=>{


    res.json({

        message:"TEST ROUTE WORKING - AFRICORE ERP"

    });


});




// SUPABASE TEST

router.get("/supabase-test", async(req,res)=>{


    try{


        const {

            data,

            error

        } = await supabase


        .from("exams")


        .select(`

            id,

            exam_name,

            exam_type,

            term,

            status,

            ai_status

        `)


        .order(
            "id",
            {
                ascending:false
            }
        )

        .limit(10);





        if(error){


            return res.status(500).json({

                success:false,

                error:error.message

            });


        }





        res.json({


            success:true,


            message:
            "Supabase connected successfully",


            exams:data


        });





    }catch(error){



        res.status(500).json({

            success:false,

            error:error.message

        });



    }



});




export default router;