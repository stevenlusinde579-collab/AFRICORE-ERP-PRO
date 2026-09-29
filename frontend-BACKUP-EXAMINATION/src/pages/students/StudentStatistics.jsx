import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";


function StudentStatistics(){


const [stats,setStats]=useState({

total:0,
male:0,
female:0,
active:0,
newAdmissions:0

});



useEffect(()=>{

loadStatistics();

},[]);






const loadStatistics=async()=>{


// TOTAL STUDENTS

const {count:total}=await supabase

.from("students")

.select("*",{count:"exact",head:true});







// MALE

const {count:male}=await supabase

.from("students")

.select("*",{count:"exact",head:true})

.eq("gender","Male");







// FEMALE

const {count:female}=await supabase

.from("students")

.select("*",{count:"exact",head:true})

.eq("gender","Female");







// ACTIVE

const {count:active}=await supabase

.from("students")

.select("*",{count:"exact",head:true})

.eq("status","Active");







// NEW ADMISSIONS THIS MONTH

const firstDay = new Date();

firstDay.setDate(1);


const {count:newAdmissions}=await supabase

.from("students")

.select("*",{count:"exact",head:true})

.gte(

"admission_date",

firstDay.toISOString().split("T")[0]

);







setStats({

total:total || 0,

male:male || 0,

female:female || 0,

active:active || 0,

newAdmissions:newAdmissions || 0

});



};








const statistics=[


{

title:"Total Students",

value:stats.total,

color:"bg-blue-600"

},



{

title:"Male Students",

value:stats.male,

color:"bg-green-600"

},



{

title:"Female Students",

value:stats.female,

color:"bg-pink-600"

},



{

title:"Active Students",

value:stats.active,

color:"bg-purple-600"

},



{

title:"New Admissions",

value:stats.newAdmissions,

color:"bg-orange-600"

}



];









return(


<div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-6">


{

statistics.map(item=>(


<div

key={item.title}

className={`${item.color} text-white rounded-xl shadow-lg p-6`}

>


<p className="text-sm opacity-80">

{item.title}

</p>



<h2 className="text-3xl font-bold mt-3">

{item.value}

</h2>



</div>


))


}



</div>


);


}



export default StudentStatistics;