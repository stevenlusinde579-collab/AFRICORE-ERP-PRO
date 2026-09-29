import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";



function AIAnalysisDashboard(){


const {examId}=useParams();



const [analysis,setAnalysis]=useState(null);

const [loading,setLoading]=useState(true);

const [error,setError]=useState("");





useEffect(()=>{


loadAnalysis();


},[]);







const loadAnalysis=async()=>{


try{


setLoading(true);



const response=await fetch(

`http://localhost:5000/api/ai/analysis/${examId}`

);





const data=await response.json();




console.log(

"AI RESPONSE:",

data

);





if(!data.success){


throw new Error(

data.message

);


}




setAnalysis(

data.analysis

);






}

catch(err){


console.log(err);


setError(err.message);



}

finally{


setLoading(false);


}



};









if(loading){


return(

<div className="p-6">

Loading AI Analysis...

</div>

);


}







if(error){


return(

<div className="p-6 bg-red-100 text-red-700 rounded">

{error}

</div>

);


}









if(!analysis){


return(

<div className="p-6 bg-yellow-100 rounded">

No AI Analysis Found

</div>

);


}








return(


<div className="space-y-6 p-6">







{/* HEADER */}


<div className="bg-white rounded-xl shadow p-6">


<h1 className="text-3xl font-bold text-blue-700">

🤖 AI Examination Intelligence Report

</h1>


<p className="text-gray-500 mt-2">

Automated examination analysis powered by Gemini AI

</p>


</div>









{/* SUMMARY */}



<div className="grid md:grid-cols-4 gap-5">



<div className="bg-white shadow rounded-xl p-5">

<p className="text-gray-500">

Subject

</p>


<h2 className="text-xl font-bold">

{analysis.subject || "Unknown"}

</h2>


</div>







<div className="bg-white shadow rounded-xl p-5">

<p className="text-gray-500">

Level

</p>


<h2 className="text-xl font-bold">

{analysis.level || "Unknown"}

</h2>


</div>







<div className="bg-white shadow rounded-xl p-5">

<p className="text-gray-500">

Questions

</p>


<h2 className="text-3xl font-bold text-blue-600">

{analysis.total_questions}

</h2>


</div>







<div className="bg-white shadow rounded-xl p-5">

<p className="text-gray-500">

Quality Score

</p>


<h2 className="text-3xl font-bold text-green-600">

{analysis.quality_score}%

</h2>


</div>



</div>









{/* TOPICS */}



<div className="bg-white shadow rounded-xl p-6">


<h2 className="text-xl font-bold mb-4">

📚 Topics Detected

</h2>



<div className="flex flex-wrap gap-3">


{

analysis.topics_found?.map(

(topic,index)=>(


<span

key={index}

className="bg-blue-100 text-blue-700 px-4 py-2 rounded-full"

>


{topic}


</span>


)

)


}



</div>



</div>









{/* QUESTION ANALYSIS */}




<div className="bg-white shadow rounded-xl p-6">


<h2 className="text-xl font-bold mb-5">

📝 Question Analysis

</h2>





<div className="overflow-x-auto">



<table className="w-full border">


<thead className="bg-gray-100">


<tr>


<th className="p-3 border">

Question

</th>


<th className="p-3 border">

Topic

</th>



<th className="p-3 border">

Difficulty

</th>



<th className="p-3 border">

Marks

</th>


<th className="p-3 border">

Explanation

</th>


</tr>


</thead>





<tbody>


{

analysis.question_analysis?.map(

(q,index)=>(


<tr key={index}>


<td className="border p-3">

{q.question_number}

</td>


<td className="border p-3">

{q.topic}

</td>


<td className="border p-3">

<span

className={

q.difficulty==="Hard"

?

"text-red-600 font-bold"

:

q.difficulty==="Medium"

?

"text-orange-600"

:

"text-green-600"

}

>

{q.difficulty}

</span>

</td>


<td className="border p-3">

{q.marks}

</td>


<td className="border p-3">

{q.explanation}

</td>


</tr>


)


)


}



</tbody>



</table>



</div>



</div>









{/* RECOMMENDATION */}




<div className="bg-purple-50 border border-purple-200 rounded-xl p-6">


<h2 className="text-xl font-bold text-purple-700">

🤖 AI Recommendation

</h2>



<p className="mt-3 text-gray-700">

{analysis.recommendations}

</p>



</div>






</div>



);


}




export default AIAnalysisDashboard;