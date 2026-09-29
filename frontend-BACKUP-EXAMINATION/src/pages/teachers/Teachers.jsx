import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function Teachers(){

const navigate = useNavigate();

const [teachers,setTeachers]=useState([]);

const [loading,setLoading]=useState(true);

const [search,setSearch]=useState("");



useEffect(()=>{

loadTeachers();

},[]);





const loadTeachers=async()=>{


const {data,error}=await supabase

.from("teachers")

.select("*")

.order("created_at",{ascending:false});



if(error){

console.log(error);

}else{

setTeachers(data || []);

}


setLoading(false);


};







const deleteTeacher=async(id,photo_url)=>{


const confirm=window.confirm(
"Delete this teacher?"
);


if(!confirm)return;



const {error}=await supabase

.from("teachers")

.delete()

.eq("id",id);



if(error){

alert(error.message);

}else{


alert(
"Teacher deleted successfully"
);


loadTeachers();


}


};








const filtered=teachers.filter((teacher)=>{


const name=

`${teacher.first_name}

${teacher.middle_name}

${teacher.last_name}`.toLowerCase();



return name.includes(
search.toLowerCase()
);


});








if(loading){

return(

<div className="bg-white p-6 rounded-xl shadow">

Loading teachers...

</div>

)

}






return(

<div>



<div className="flex justify-between mb-6">


<div>

<h1 className="text-3xl font-bold">

Teacher Management

</h1>

<p className="text-gray-600">

Manage all teachers

</p>


</div>



<button

onClick={()=>navigate("/teachers/add")}

className="bg-blue-600 text-white px-5 py-3 rounded-lg"

>

+ Add Teacher

</button>


</div>







<input

placeholder="Search teacher..."

value={search}

onChange={(e)=>setSearch(e.target.value)}

className="border p-3 rounded-lg w-full mb-5"

/>







<div className="bg-white shadow rounded-xl overflow-hidden">



<table className="w-full">


<thead className="bg-gray-100">


<tr>


<th className="p-4 text-left">
Photo
</th>


<th className="p-4 text-left">
Name
</th>


<th className="p-4 text-left">
Employee No
</th>


<th className="p-4 text-left">
Gender
</th>


<th className="p-4 text-left">
Phone
</th>


<th className="p-4 text-left">
Specialization
</th>


<th className="p-4 text-left">
Action
</th>


</tr>


</thead>





<tbody>



{

filtered.map((teacher)=>(


<tr

key={teacher.id}

className="border-t"

>




<td className="p-4">


{

teacher.photo_url ?


<img

src={teacher.photo_url}

className="w-12 h-12 rounded-full object-cover"

/>


:


<div className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center">

{teacher.first_name.charAt(0)}

</div>


}



</td>






<td className="p-4 font-semibold">


{teacher.first_name}

{" "}

{teacher.middle_name}

{" "}

{teacher.last_name}


</td>






<td className="p-4">

{teacher.employee_number}

</td>





<td className="p-4">

{teacher.gender}

</td>





<td className="p-4">

{teacher.phone}

</td>





<td className="p-4">

{teacher.specialization}

</td>








<td className="p-4 flex gap-2">



<button

onClick={()=>navigate(`/teachers/profile/${teacher.id}`)}

className="bg-green-600 text-white px-3 py-2 rounded"

>

View

</button>




<button

onClick={()=>navigate(`/teachers/edit/${teacher.id}`)}

className="bg-blue-600 text-white px-3 py-2 rounded"

>

Edit

</button>





<button

onClick={()=>deleteTeacher(

teacher.id,

teacher.photo_url

)}

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



</div>


)


}


export default Teachers;