import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AssignmentProfile(){


const {id}=useParams();

const navigate=useNavigate();


const [assignment,setAssignment]=useState(null);

const [loading,setLoading]=useState(true);









useEffect(()=>{


loadAssignment();


},[]);









const loadAssignment=async()=>{


const {data,error}=await supabase

.from("teacher_assignments")

.select(`

*

,

teachers(

first_name,

last_name,

phone

)

,

subjects(

subject_name,

subject_code

)

,

classes(

class_name

)

`)

.eq("id",id)

.single();







console.log("ASSIGNMENT PROFILE:",data);

console.log("ERROR:",error);







if(error){

console.log(error.message);

}else{

setAssignment(data);

}




setLoading(false);



};









if(loading){

return(

<div className="p-6">

Loading assignment...

</div>

);

}









if(!assignment){

return(

<div className="p-6">

Assignment not found

</div>

);

}









return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">





<div>

<h1 className="text-3xl font-bold text-gray-800">

Assignment Profile

</h1>


<p className="text-gray-600">

AfriCore ERP PRO

</p>


</div>








<button

onClick={()=>navigate("/teacher-assignment")}

className="bg-gray-600 text-white px-5 py-2 rounded"

>

Back

</button>





</div>









<div className="bg-white shadow rounded-xl p-6">





<h2 className="text-2xl font-bold mb-6">

Teacher Assignment Details

</h2>









<div className="grid md:grid-cols-2 gap-5">





<p>

<strong>Teacher:</strong>

{" "}

{assignment.teachers?.first_name}

{" "}

{assignment.teachers?.last_name}

</p>









<p>

<strong>Subject:</strong>

{" "}

{assignment.subjects?.subject_name}

</p>









<p>

<strong>Subject Code:</strong>

{" "}

{assignment.subjects?.subject_code || "-"}

</p>









<p>

<strong>Class:</strong>

{" "}

{assignment.classes?.class_name}

</p>









<p>

<strong>Teacher Phone:</strong>

{" "}

{assignment.teachers?.phone || "-"}

</p>









<p>

<strong>Created:</strong>

{" "}

{assignment.created_at}

</p>








</div>









<div className="mt-6">





<button

onClick={()=>navigate(`/teacher-assignment/edit/${assignment.id}`)}

className="bg-blue-600 text-white px-5 py-3 rounded"

>

Edit Assignment

</button>






</div>







</div>







</div>

);


}



export default AssignmentProfile;