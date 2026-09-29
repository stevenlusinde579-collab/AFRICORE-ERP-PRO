import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";


function ClassStatistics(){


const [stats,setStats]=useState({

total:0,
primary:0,
secondary:0,
levels:0

});






const fetchStatistics=async()=>{


const {data,error}=await supabase

.from("classes")

.select("*");






if(error){

console.log(
"CLASS STATISTICS ERROR:",
error
);

return;

}





const total=data.length;



const primary=data.filter(

item=>

item.academic_level?.toLowerCase()
.includes("primary")

).length;






const secondary=data.filter(

item=>

item.academic_level?.toLowerCase()
.includes("secondary")

).length;






const uniqueLevels=[

...new Set(

data.map(

item=>item.academic_level

)

)

];






setStats({

total,

primary,

secondary,

levels:uniqueLevels.length

});





};








useEffect(()=>{

fetchStatistics();

},[]);








return (

<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">





<div className="bg-white shadow rounded-xl p-6">

<p className="text-gray-500">

Total Classes

</p>


<h2 className="text-3xl font-bold text-blue-600 mt-2">

{stats.total}

</h2>


</div>








<div className="bg-white shadow rounded-xl p-6">

<p className="text-gray-500">

Primary Classes

</p>


<h2 className="text-3xl font-bold text-green-600 mt-2">

{stats.primary}

</h2>


</div>








<div className="bg-white shadow rounded-xl p-6">

<p className="text-gray-500">

Secondary Classes

</p>


<h2 className="text-3xl font-bold text-purple-600 mt-2">

{stats.secondary}

</h2>


</div>








<div className="bg-white shadow rounded-xl p-6">

<p className="text-gray-500">

Academic Levels

</p>


<h2 className="text-3xl font-bold text-orange-600 mt-2">

{stats.levels}

</h2>


</div>





</div>


);


}


export default ClassStatistics;