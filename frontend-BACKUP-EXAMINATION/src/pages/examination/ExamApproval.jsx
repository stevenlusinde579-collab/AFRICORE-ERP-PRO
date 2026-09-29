import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useParams } from "react-router-dom";


function ExamApproval(){


const { examId } = useParams();


const [exam,setExam]=useState(null);

const [analysis,setAnalysis]=useState(null);

const [role,setRole]=useState("");

const [loading,setLoading]=useState(true);







useEffect(()=>{

loadData();

},[]);








const loadData = async()=>{


try{


setLoading(true);



// CURRENT USER

const {

data:{user}

}=await supabase.auth.getUser();







// GET ROLE

const {data:profile}=await supabase

.from("profiles")

.select(`

roles(

role_name

)

`)

.eq(

"id",

user.id

)

.single();






if(profile?.roles){

setRole(
profile.roles.role_name
);

}








// GET EXAM


const {data:examData}=await supabase

.from("exams")

.select("*")

.eq(

"id",

examId

)

.single();





setExam(examData);









// GET AI ANALYSIS


const {data:aiData}=await supabase

.from("exam_ai_analysis")

.select("*")

.eq(

"exam_id",

examId

)

.order(

"id",

{

ascending:false

}

)

.limit(1)

.single();






setAnalysis(aiData || null);







}catch(error){


console.log(error);


}

finally{


setLoading(false);


}


};









const approveExam = async(type)=>{



if(!analysis){


alert(

"AI Analysis haijakamilika. Tafadhali chambua paper kwanza."

);


return;


}







const {

data:{user}

}=await supabase.auth.getUser();






let update={};






if(type==="academic"){


update={

approved_by_academic:user.id,

academic_approved_at:new Date()

};


}





if(type==="deputy"){


update={

approved_by_deputy:user.id,

deputy_approved_at:new Date()

};


}





if(type==="headmaster"){


update={

approved_by_headmaster:user.id,

approved_at:new Date(),

status:"Approved"

};


}








const {error}=await supabase

.from("exams")

.update(update)

.eq(

"id",

examId

);







if(error){


alert(error.message);


}else{


alert(

"Approval completed successfully"

);


loadData();


}



};









if(loading){


return(

<div className="p-6">

Loading approval...

</div>

);


}









return(


<div className="space-y-6">







<div className="bg-white p-6 rounded-xl shadow">


<h1 className="text-2xl font-bold">

Exam Approval Center

</h1>


<p className="text-gray-500">

{exam?.exam_name}

</p>



</div>









{/* AI REPORT */}



<div className="bg-blue-50 p-6 rounded-xl shadow">


<h2 className="text-xl font-bold text-blue-700">

🤖 AI Analysis Report

</h2>





{

analysis

?

(

<div className="grid md:grid-cols-4 gap-4 mt-4">



<div>

Questions

<h3 className="font-bold text-xl">

{analysis.total_questions}

</h3>

</div>




<div>

Difficulty

<h3 className="font-bold text-xl">

{analysis.difficulty}

</h3>

</div>




<div>

Quality

<h3 className="font-bold text-xl">

{analysis.quality_score}/100

</h3>

</div>




<div>

Coverage

<h3 className="font-bold text-xl">

{analysis.syllabus_coverage}%

</h3>

</div>




</div>

)


:

(

<p className="text-red-600 mt-3">

AI Analysis haipo. Upload PDF na chunguza kwanza.

</p>

)



}



</div>









{/* APPROVAL */}

<div className="bg-white p-6 rounded-xl shadow space-y-4">





<div className="flex justify-between border-b pb-3">


<span>

Academic Approval

</span>


{

exam?.approved_by_academic

?

<span className="text-green-600">

Approved

</span>


:

<button

onClick={()=>approveExam("academic")}

className="bg-blue-600 text-white px-4 py-2 rounded"

>

Approve

</button>

}


</div>









<div className="flex justify-between border-b pb-3">


<span>

Deputy Headmaster Approval

</span>


{

exam?.approved_by_deputy

?

<span className="text-green-600">

Approved

</span>


:

<button

onClick={()=>approveExam("deputy")}

className="bg-orange-600 text-white px-4 py-2 rounded"

>

Approve

</button>

}


</div>









<div className="flex justify-between">


<span>

Headmaster Approval

</span>


{

exam?.approved_by_headmaster

?

<span className="text-green-600">

Approved

</span>


:

<button

onClick={()=>approveExam("headmaster")}

className="bg-green-700 text-white px-4 py-2 rounded"

>

Approve

</button>

}


</div>






</div>









<div className="bg-gray-100 p-4 rounded">


Current Role:

<strong>

{" "}

{role}

</strong>



</div>






</div>


);


}


export default ExamApproval;