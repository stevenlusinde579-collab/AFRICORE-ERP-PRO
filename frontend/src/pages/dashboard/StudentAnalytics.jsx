import { useEffect, useState } from "react";

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
  Legend
} from "recharts";

import { supabase } from "../../services/supabase";



function StudentAnalytics(){


const [data,setData]=useState([]);



const COLORS = [
  "#2563eb",
  "#ec4899"
];





const loadGenderData = async()=>{


const {data:students,error}=await supabase

.from("students")

.select("gender");




if(error){

console.log("Gender Error:",error);

return;

}





let male = 0;

let female = 0;





students.forEach((student)=>{


if(!student.gender) return;



const gender = student.gender.toString().toLowerCase().trim();




if(
gender === "male" ||
gender === "m"
){

male++;

}




if(
gender === "female" ||
gender === "f"
){

female++;

}



});







setData([

{
name:"Male",
value:male
},

{
name:"Female",
value:female
}

]);


};







useEffect(()=>{

loadGenderData();

},[]);









return(


<div className="bg-white rounded-xl shadow p-6">


<h2 className="text-xl font-semibold mb-5">

Student Gender Analysis

</h2>





<div className="h-[300px]">



<ResponsiveContainer width="100%" height="100%">



<PieChart>



<Pie

data={data}

dataKey="value"

nameKey="name"

cx="50%"

cy="50%"

outerRadius={100}

label={({name,value})=>`${name}: ${value}`}

>


{

data.map((entry,index)=>(


<Cell

key={`cell-${index}`}

fill={COLORS[index]}

/>


))


}



</Pie>





<Tooltip/>

<Legend/>



</PieChart>



</ResponsiveContainer>



</div>





</div>


);


}



export default StudentAnalytics;