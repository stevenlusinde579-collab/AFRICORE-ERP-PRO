// src/pages/teachers/TeacherProfile.jsx

import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";
import { resolveSchoolPhotoUrl } from "../../utils/schoolPhotoUrl";


function TeacherProfile(){

const { id } = useParams();
const navigate = useNavigate();

const [teacher,setTeacher] = useState(null);
const [photoDisplayUrl,setPhotoDisplayUrl] = useState("");
const [loading,setLoading] = useState(true);



useEffect(()=>{

getTeacher();

},[id]);



const getTeacher = async()=>{

const {data,error}=await supabase
.from("teachers")
.select("*")
.eq("id",id)
.single();


if(error){

console.log("Teacher Error:",error);

}else{

setTeacher(data);
setPhotoDisplayUrl(
  data.photo_url
    ? await resolveSchoolPhotoUrl("teacher-photos", data.photo_url)
    : ""
);

}


setLoading(false);

};




if(loading){

return (
<div className="p-6">
Loading teacher information...
</div>
)

}



if(!teacher){

return (
<div className="p-6">
Teacher not found
</div>
)

}



return (

<div className="p-6">


<div className="flex justify-between items-center mb-6">


<h1 className="text-3xl font-bold">
Teacher Profile
</h1>


<button

onClick={()=>navigate(`/teachers/edit/${id}`)}

className="bg-blue-600 text-white px-4 py-2 rounded"

>
Edit Teacher
</button>


</div>





<div className="bg-white shadow rounded-lg p-6">


<div className="flex gap-6">


{

photoDisplayUrl &&

<img

src={photoDisplayUrl}

alt="Teacher"

className="w-32 h-32 rounded-full object-cover"

/>

}



<div>


<h2 className="text-xl font-bold">

{teacher.first_name} {teacher.middle_name} {teacher.last_name}

</h2>


<p>
Employee Number:
<strong> {teacher.employee_number}</strong>
</p>


<p>
Status:
<strong> {teacher.status}</strong>
</p>


</div>


</div>


</div>







<div className="grid grid-cols-2 gap-5 mt-6">



<div className="bg-white shadow rounded p-5">

<h3 className="font-bold text-lg mb-3">
Personal Information
</h3>


<p>
Gender: {teacher.gender}
</p>


<p>
Phone: {teacher.phone}
</p>


<p>
Email: {teacher.email}
</p>


</div>






<div className="bg-white shadow rounded p-5">

<h3 className="font-bold text-lg mb-3">
Employment Information
</h3>


<p>
Employment Date: {teacher.employment_date}
</p>


<p>
Qualification: {teacher.qualification}
</p>


<p>
Specialization: {teacher.specialization}
</p>


</div>



</div>





<div className="bg-white shadow rounded p-5 mt-6">


<h3 className="font-bold text-lg mb-3">
System Information
</h3>


<p>
Teacher ID: {teacher.id}
</p>


<p>
School ID: {teacher.school_id}
</p>


<p>
Created At: {teacher.created_at}
</p>



</div>



</div>

)


}


export default TeacherProfile;