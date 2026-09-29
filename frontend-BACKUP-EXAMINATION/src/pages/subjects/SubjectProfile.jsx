import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function SubjectProfile(){


const {id}=useParams();

const navigate=useNavigate();


const [subject,setSubject]=useState(null);

const [loading,setLoading]=useState(true);









useEffect(()=>{


loadSubject();


},[]);









const loadSubject=async()=>{


const {data,error}=await supabase

.from("subjects")

.select("*")

.eq("id",id)

.single();







console.log("SUBJECT PROFILE:",data);

console.log("ERROR:",error);







if(error){

console.log(error.message);

}else{

setSubject(data);

}



setLoading(false);



};









if(loading){

return (

<div className="p-6">

Loading subject...

</div>

);

}









if(!subject){

return (

<div className="p-6">

Subject not found

</div>

);

}









return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">





<div>


<h1 className="text-3xl font-bold text-gray-800">

Subject Profile

</h1>


<p className="text-gray-600">

AfriCore ERP PRO

</p>


</div>







<button

onClick={()=>navigate("/subjects")}

className="bg-gray-600 text-white px-5 py-2 rounded"

>

Back

</button>





</div>









<div className="bg-white shadow rounded-xl p-6">





<h2 className="text-2xl font-bold mb-6">

{subject.subject_name}

</h2>









<div className="grid md:grid-cols-2 gap-5">





<p>

<strong>Subject Name:</strong>

{" "}

{subject.subject_name || "-"}

</p>








<p>

<strong>Subject Code:</strong>

{" "}

{subject.subject_code || "-"}

</p>








<p>

<strong>Status:</strong>

{" "}

{subject.status || "Active"}

</p>








<p>

<strong>Subject ID:</strong>

{" "}

{subject.id}

</p>








<p>

<strong>Created At:</strong>

{" "}

{subject.created_at || "-"}

</p>







</div>









<div className="mt-6">





<button

onClick={()=>navigate(`/subjects/edit/${subject.id}`)}

className="bg-blue-600 text-white px-5 py-3 rounded"

>

Edit Subject

</button>






</div>







</div>







</div>

);



}



export default SubjectProfile;