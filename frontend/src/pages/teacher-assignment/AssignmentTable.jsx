import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";



function AssignmentTable(){


const navigate = useNavigate();


const [assignments,setAssignments]=useState([]);

const [loading,setLoading]=useState(true);









useEffect(()=>{


loadAssignments();


},[]);









const loadAssignments = async()=>{


setLoading(true);





const {data,error}=await supabase

.from("teacher_assignments")

.select(`

*

,

teachers(

first_name,

last_name

)

,

subjects(

subject_name

)

,

classes(

class_name

)

`)

.order("created_at",{ascending:false});







console.log("ASSIGNMENTS:",data);

console.log("ERROR:",error);






if(error){

console.log(error.message);

}else{

setAssignments(data || []);

}





setLoading(false);



};









const deleteAssignment = async(id)=>{


const confirmDelete = window.confirm(

"Delete this assignment?"

);



if(!confirmDelete)return;






const {error}=await supabase

.from("teacher_assignments")

.delete()

.eq("id",id);







if(error){

alert(error.message);

return;

}





loadAssignments();



};









if(loading){

return (

<div className="bg-white p-6 rounded shadow">

Loading assignments...

</div>

);

}









return (

<div className="bg-white rounded-xl shadow overflow-x-auto">






<table className="w-full">





<thead className="bg-slate-900 text-white">


<tr>


<th className="p-4 text-left">

Teacher

</th>



<th className="p-4 text-left">

Subject

</th>



<th className="p-4 text-left">

Class

</th>



<th className="p-4 text-center">

Actions

</th>



</tr>


</thead>









<tbody>






{

assignments.length===0 ?



<tr>

<td

colSpan="4"

className="p-6 text-center text-gray-500"

>

No assignments found

</td>

</tr>







:








assignments.map((item)=>(



<tr

key={item.id}

className="border-b"

>








<td className="p-4">

{

item.teachers?.first_name

}

{" "}

{

item.teachers?.last_name

}

</td>









<td className="p-4">

{

item.subjects?.subject_name

|| "-"

}

</td>









<td className="p-4">

{

item.classes?.class_name

|| "-"

}

</td>









<td className="p-4 text-center">






<button

onClick={()=>navigate(`/teacher-assignment/profile/${item.id}`)}

className="bg-green-600 text-white px-3 py-2 rounded mr-2"

>

View

</button>









<button

onClick={()=>navigate(`/teacher-assignment/edit/${item.id}`)}

className="bg-blue-600 text-white px-3 py-2 rounded mr-2"

>

Edit

</button>









<button

onClick={()=>deleteAssignment(item.id)}

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



export default AssignmentTable;