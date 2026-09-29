import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function ClassProfile(){


const {id}=useParams();

const navigate=useNavigate();


const [classData,setClassData]=useState(null);

const [loading,setLoading]=useState(true);








useEffect(()=>{

getClass();

},[]);









const getClass = async()=>{


const {data,error}=await supabase

.from("classes")

.select("*")

.eq("id",id)

.single();





console.log("CLASS PROFILE:",data);

console.log("ERROR:",error);







if(error){

console.log(error.message);

}else{

setClassData(data);

}



setLoading(false);


};









if(loading){

return (

<div className="p-6">

Loading class information...

</div>

);

}









if(!classData){

return (

<div className="p-6">

Class not found

</div>

);

}









return (

<div className="p-6">





<div className="flex justify-between items-center mb-6">





<div>


<h1 className="text-3xl font-bold text-gray-800">

Class Profile

</h1>


<p className="text-gray-600">

AfriCore ERP PRO

</p>


</div>







<button

onClick={()=>navigate("/classes")}

className="bg-gray-600 text-white px-5 py-2 rounded"

>

Back

</button>





</div>









<div className="bg-white shadow rounded-xl p-6">





<h2 className="text-2xl font-bold mb-6">

{classData.class_name}

</h2>








<div className="grid md:grid-cols-2 gap-5">





<p>

<strong>Class Name:</strong>

{" "}

{classData.class_name || "-"}

</p>







<p>

<strong>Level:</strong>

{" "}

{classData.level || "-"}

</p>








<p>

<strong>Stream:</strong>

{" "}

{classData.stream || "-"}

</p>








<p>

<strong>Status:</strong>

{" "}

{classData.status || "Active"}

</p>








<p>

<strong>Class ID:</strong>

{" "}

{classData.id}

</p>








<p>

<strong>Created At:</strong>

{" "}

{classData.created_at || "-"}

</p>






</div>








<div className="mt-6">


<button

onClick={()=>navigate(`/classes/edit/${classData.id}`)}

className="bg-blue-600 text-white px-5 py-3 rounded"

>

Edit Class

</button>


</div>





</div>






</div>

);



}


export default ClassProfile;