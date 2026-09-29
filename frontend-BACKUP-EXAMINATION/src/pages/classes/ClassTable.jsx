import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function ClassTable(){


const navigate = useNavigate();


const [classes,setClasses] = useState([]);

const [loading,setLoading] = useState(true);








const fetchClasses = async()=>{


setLoading(true);



const {data,error}=await supabase

.from("classes")

.select("*")

.order("created_at",{ascending:false});






console.log("CLASSES:",data);

console.log("ERROR:",error);





if(error){

console.log(error.message);

}else{

setClasses(data || []);

}



setLoading(false);


};








useEffect(()=>{

fetchClasses();

},[]);









const deleteClass = async(id)=>{


const confirmDelete = window.confirm(

"Are you sure you want to delete this class?"

);



if(!confirmDelete)return;







const {error}=await supabase

.from("classes")

.delete()

.eq("id",id);





if(error){

alert(error.message);

return;

}





fetchClasses();



};












if(loading){

return (

<div className="bg-white p-6 rounded shadow">

Loading classes...

</div>

);

}









return (

<div className="bg-white rounded-xl shadow overflow-x-auto">





<table className="w-full">



<thead className="bg-slate-900 text-white">


<tr>


<th className="p-4 text-left">

Class Name

</th>



<th className="p-4 text-left">

Level

</th>



<th className="p-4 text-left">

Stream

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

classes.length === 0 ?



<tr>

<td

colSpan="5"

className="p-6 text-center text-gray-500"

>

No classes found

</td>

</tr>





:





classes.map((item)=>(



<tr

key={item.id}

className="border-b"

>







<td className="p-4">

{

item.class_name || "-"

}

</td>







<td className="p-4">

{

item.level || "-"

}

</td>







<td className="p-4">

{

item.stream || "-"

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

onClick={()=>navigate(`/classes/profile/${item.id}`)}

className="bg-green-600 text-white px-3 py-2 rounded mr-2"

>

View

</button>








<button

onClick={()=>navigate(`/classes/edit/${item.id}`)}

className="bg-blue-600 text-white px-3 py-2 rounded mr-2"

>

Edit

</button>









<button

onClick={()=>deleteClass(item.id)}

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


export default ClassTable;