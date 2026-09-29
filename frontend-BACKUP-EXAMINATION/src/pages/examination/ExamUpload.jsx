import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";


function ExamUpload(){


const { examId } = useParams();

const navigate = useNavigate();


const [file,setFile] = useState(null);

const [loading,setLoading] = useState(false);

const [message,setMessage] = useState("");






console.log(
"CURRENT EXAM ID:",
examId
);







const uploadPaper = async()=>{


if(!file){

alert(
"Chagua PDF kwanza"
);

return;

}




try{


setLoading(true);

setMessage("");





const formData = new FormData();


formData.append(
"paper",
file
);



formData.append(
"exam_id",
examId
);





console.log(
"UPLOADING EXAM:",
examId
);


console.log(
"FILE:",
file.name
);






const response = await fetch(

"http://localhost:5000/api/ai/analyze-paper",

{

method:"POST",

body:formData

}

);





console.log(
"UPLOAD STATUS:",
response.status
);






const data = await response.json();





console.log(
"AI UPLOAD RESPONSE:",
data
);






if(!data.success){


throw new Error(

data.message ||

data.error ||

"AI analysis failed"

);


}







setMessage(

"PDF uploaded. AI analysis completed."

);







setTimeout(()=>{


navigate(

`/examination/${examId}/ai-analysis`

);


},1500);








}

catch(error){


console.error(
"UPLOAD ERROR:",
error
);


setMessage(

error.message

);



}

finally{


setLoading(false);


}




};









return(


<div className="space-y-6">



<div className="bg-white p-6 rounded-xl shadow">


<h1 className="text-2xl font-bold">

Upload Examination Paper

</h1>


<p className="text-gray-500">

Exam ID: {examId}

</p>



</div>







<div className="bg-white p-6 rounded-xl shadow space-y-5">



<label className="font-semibold">

Select PDF Examination Paper

</label>





<input

type="file"

accept=".pdf"

onChange={(e)=>

setFile(
e.target.files[0]
)

}

className="border p-3 rounded w-full"

/>







{

file &&

<div className="bg-blue-100 p-3 rounded">

Selected:

<strong>

{file.name}

</strong>

</div>


}








<button

onClick={uploadPaper}

disabled={loading}

className="bg-green-600 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Uploading & AI Analyzing..."

:

"Upload Paper"

}



</button>








{

message &&

<div className="bg-gray-100 p-4 rounded">

{message}

</div>

}




</div>





</div>


);


}


export default ExamUpload;