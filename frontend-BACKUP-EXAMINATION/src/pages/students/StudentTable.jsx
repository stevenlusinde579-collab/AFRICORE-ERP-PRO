import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function StudentTable({filters}){


const navigate = useNavigate();


const [students,setStudents] = useState([]);

const [loading,setLoading] = useState(true);





const fetchStudents = async()=>{


setLoading(true);



const {data,error}=await supabase

.from("students")

.select(`

id,
admission_number,
first_name,
middle_name,
last_name,
gender,
status,
student_status,
current_class_id,
class_name,
created_at

`)

.order("created_at",{ascending:false});





if(error){

console.log("Student Fetch Error:",error);

}else{

setStudents(data || []);

}



setLoading(false);


};






useEffect(()=>{

fetchStudents();

},[]);









const deleteStudent = async(id)=>{


const confirmDelete = window.confirm(

"Delete this student?"

);



if(!confirmDelete)return;





const {error}=await supabase

.from("students")

.delete()

.eq("id",id);





if(error){

alert(error.message);

return;

}





fetchStudents();



};









const filteredStudents = students.filter((student)=>{


const search = filters?.search?.toLowerCase() || "";



const name = (

`${student.first_name || ""} 
${student.middle_name || ""} 
${student.last_name || ""}`

).toLowerCase();




return (

name.includes(search)

||

student.admission_number

?.toLowerCase()

.includes(search)


);



});









if(loading){

return (

<div className="bg-white p-6 rounded shadow">

Loading students...

</div>

);

}









return (

<div className="bg-white rounded-xl shadow overflow-x-auto">



<table className="w-full">



<thead className="bg-slate-900 text-white">


<tr>


<th className="p-4 text-left">
Admission No
</th>


<th className="p-4 text-left">
Name
</th>


<th className="p-4 text-left">
Gender
</th>


<th className="p-4 text-left">
Class
</th>


<th className="p-4 text-left">
Status
</th>


<th className="p-4 text-center">
Actions
</th>


</tr>


</thead>







<tbody>



{

filteredStudents.length===0 ?


<tr>

<td

colSpan="6"

className="p-6 text-center"

>

No students found

</td>

</tr>

:



filteredStudents.map((student)=>(


<tr

key={student.id}

className="border-b"

>


<td className="p-4">

{student.admission_number}

</td>





<td className="p-4">

{student.first_name}

{" "}

{student.middle_name}

{" "}

{student.last_name}

</td>





<td className="p-4">

{student.gender}

</td>






<td className="p-4">

{student.class_name || "-"}

</td>






<td className="p-4">

{student.status || student.student_status}

</td>








<td className="p-4 text-center">



<button

onClick={()=>navigate(`/students/profile/${student.id}`)}

className="bg-green-600 text-white px-3 py-2 rounded mr-2"

>

View

</button>






<button

onClick={()=>navigate(`/students/edit/${student.id}`)}

className="bg-blue-600 text-white px-3 py-2 rounded mr-2"

>

Edit

</button>







<button

onClick={()=>deleteStudent(student.id)}

className="bg-red-600 text-white px-3 py-2 rounded"

>

Delete

</button>



</td>



</tr>


))


}



</tbody>





</table>




</div>


);



}


export default StudentTable;