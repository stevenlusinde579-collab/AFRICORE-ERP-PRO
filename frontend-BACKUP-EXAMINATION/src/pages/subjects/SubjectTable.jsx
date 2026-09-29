import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function SubjectTable({filters}){


const navigate = useNavigate();


const [subjects,setSubjects] = useState([]);

const [loading,setLoading] = useState(true);









const fetchSubjects = async()=>{


setLoading(true);



const {data,error}=await supabase

.from("subjects")

.select("*")

.order("created_at",{ascending:false});







console.log("SUBJECTS:",data);

console.log("ERROR:",error);







if(error){

console.log(error.message);

}else{

setSubjects(data || []);

}



setLoading(false);



};









useEffect(()=>{


fetchSubjects();


},[]);









const deleteSubject = async(id)=>{


const confirmDelete = window.confirm(

"Are you sure you want to delete this subject?"

);



if(!confirmDelete)return;






const {error}=await supabase

.from("subjects")

.delete()

.eq("id",id);







if(error){

alert(error.message);

return;

}





fetchSubjects();



};









const filteredSubjects = subjects.filter((item)=>{


const search = filters?.search?.toLowerCase() || "";



const name = (

item.subject_name || ""

).toLowerCase();




return name.includes(search);



});









if(loading){

return (

<div className="bg-white p-6 rounded shadow">

Loading subjects...

</div>

);

}









return (

<div className="bg-white rounded-xl shadow overflow-x-auto">





<table className="w-full">



<thead className="bg-slate-900 text-white">


<tr>


<th className="p-4 text-left">

Subject Name

</th>



<th className="p-4 text-left">

Code

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

filteredSubjects.length===0 ?



<tr>

<td

colSpan="4"

className="p-6 text-center text-gray-500"

>

No subjects found

</td>

</tr>







:







filteredSubjects.map((item)=>(



<tr

key={item.id}

className="border-b"

>







<td className="p-4">

{

item.subject_name || "-"

}

</td>








<td className="p-4">

{

item.subject_code || "-"

}

</td>








<td className="p-4">


<span

className={`px-3 py-1 rounded-full text-sm

${
item.status==="Active"

?

"bg-green-100 text-green-700"

:

"bg-red-100 text-red-700"

}

`}

>


{

item.status || "Active"

}


</span>



</td>









<td className="p-4 text-center">






<button

onClick={()=>navigate(`/subjects/profile/${item.id}`)}

className="bg-green-600 text-white px-3 py-2 rounded mr-2"

>

View

</button>









<button

onClick={()=>navigate(`/subjects/edit/${item.id}`)}

className="bg-blue-600 text-white px-3 py-2 rounded mr-2"

>

Edit

</button>









<button

onClick={()=>deleteSubject(item.id)}

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



export default SubjectTable;