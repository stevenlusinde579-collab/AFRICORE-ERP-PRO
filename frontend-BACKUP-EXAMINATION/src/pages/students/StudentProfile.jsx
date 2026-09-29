import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function StudentProfile(){


const {id}=useParams();

const navigate=useNavigate();


const [student,setStudent]=useState(null);

const [loading,setLoading]=useState(true);






useEffect(()=>{

getStudent();

},[]);









const getStudent = async()=>{


const {data,error}=await supabase

.from("students")

.select("*")

.eq("id",id)

.single();





if(error){

console.log("PROFILE ERROR:",error);

}else{

setStudent(data);

}



setLoading(false);



};









if(loading){

return (

<div className="p-6">

Loading student information...

</div>

);

}









if(!student){

return (

<div className="p-6">

Student not found

</div>

);

}









return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">



<div>

<h1 className="text-3xl font-bold">

Student Profile

</h1>



<p className="text-gray-600">

AfriCore ERP PRO

</p>


</div>






<button

onClick={()=>navigate("/students")}

className="bg-gray-600 text-white px-5 py-2 rounded"

>

Back

</button>



</div>









<div className="bg-white shadow rounded-xl p-6">





<h2 className="text-2xl font-bold mb-4">

{

student.first_name

}

{" "}

{

student.middle_name

}

{" "}

{

student.last_name

}

</h2>





<div className="grid md:grid-cols-2 gap-4">



<p>

<strong>Admission Number:</strong>

{" "}

{student.admission_number}

</p>





<p>

<strong>Gender:</strong>

{" "}

{student.gender}

</p>






<p>

<strong>Date Of Birth:</strong>

{" "}

{student.date_of_birth || "-"}

</p>






<p>

<strong>Class:</strong>

{" "}

{student.class_name || "-"}

</p>







<p>

<strong>Status:</strong>

{" "}

{student.status || student.student_status}

</p>







<p>

<strong>Phone:</strong>

{" "}

{student.phone || "-"}

</p>






</div>



</div>










<div className="bg-white shadow rounded-xl p-6 mt-6">



<h2 className="text-xl font-bold mb-4">

Parent Information

</h2>





<p>

Parent Name:

{" "}

{student.parent_name || "-"}

</p>





<p>

Parent Phone:

{" "}

{student.parent_phone || "-"}

</p>






<p>

Parent Email:

{" "}

{student.parent_email || "-"}

</p>






</div>







</div>

);



}



export default StudentProfile;