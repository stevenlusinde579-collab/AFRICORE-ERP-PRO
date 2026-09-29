import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";


function SubjectStatistics(){


const [stats,setStats]=useState({

total:0,
active:0,
compulsory:0

});




const loadStats=async()=>{


const {data,error}=await supabase

.from("subjects")

.select("*");



if(error){

console.log(error);

return;

}



setStats({

total:data.length,


active:data.filter(
(item)=>item.is_active===true
).length,


compulsory:data.filter(
(item)=>item.is_compulsory===true
).length

});



};






useEffect(()=>{


loadStats();


},[]);







return(


<div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-6">





<div className="bg-white rounded-xl shadow p-5">

<h3 className="text-gray-500">

Total Subjects

</h3>


<p className="text-3xl font-bold text-blue-600">

{stats.total}

</p>


</div>








<div className="bg-white rounded-xl shadow p-5">

<h3 className="text-gray-500">

Active Subjects

</h3>


<p className="text-3xl font-bold text-green-600">

{stats.active}

</p>


</div>








<div className="bg-white rounded-xl shadow p-5">

<h3 className="text-gray-500">

Compulsory Subjects

</h3>


<p className="text-3xl font-bold text-purple-600">

{stats.compulsory}

</p>


</div>






</div>


);


}



export default SubjectStatistics;