import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function TimetableTable(){


const navigate = useNavigate();


const schoolId = 1;



const [timetable,setTimetable] = useState([]);

const [columns,setColumns] = useState([]);

const [loading,setLoading] = useState(true);

const [settings,setSettings] = useState(null);

const [school,setSchool] = useState(null);








useEffect(()=>{

loadTimetable();

},[]);










const timeToMinutes=(time)=>{


if(!time) return 0;


const [h,m]=time.split(":");


return Number(h)*60 + Number(m);


};









// ================= LOAD TIMETABLE =================


const loadTimetable=async()=>{


setLoading(true);






const {

data:tableData,

error:tableError

}=await supabase


.from("class_timetables")


.select(`


id,


day_name,

period_id,

start_time,

end_time,

session,



classes(

id,

class_name,

academic_level

),



subjects(

subject_name

),



teachers(

first_name,

last_name

)



`)


.order("id");






console.log("TIMETABLE:",tableData);

console.log("ERROR:",tableError);









// CREATE PERIOD LIST


const periodData=[


...new Map(


(tableData || [])


.filter(item=>item.period_id)


.map(item=>[


item.period_id,


{


id:item.period_id,


period_name:`Period ${item.period_id}`,


start_time:item.start_time,


end_time:item.end_time


}


])


).values()


];











// GET SETTINGS


const {

data:settingData,

error:settingError

}=await supabase


.from("timetable_settings")


.select("*")


.eq("school_id",schoolId)


.maybeSingle();






console.log("SETTINGS:",settingData);

console.log(settingError);









// GET SCHOOL


const {

data:schoolData,

error:schoolError

}=await supabase


.from("schools")


.select("school_name")


.eq("id",schoolId)


.maybeSingle();






console.log("SCHOOL:",schoolData);

console.log(schoolError);









setTimetable(tableData || []);


setSettings(settingData);


setSchool(schoolData);





createColumns(

periodData,

settingData

);



setLoading(false);



};












// ================= CREATE COLUMNS =================


const createColumns=(periodData,setting)=>{


let result=[];






periodData.forEach(period=>{


result.push({


type:"period",


id:period.id,


name:period.period_name,


start:period.start_time,


end:period.end_time



});


});









if(setting && setting.break_start && setting.break_end){


result.push({


type:"break",


id:"break",


name:"BREAK",


start:setting.break_start,


end:setting.break_end



});


}









if(setting && setting.lunch_start && setting.lunch_end){


result.push({


type:"lunch",


id:"lunch",


name:"LUNCH",


start:setting.lunch_start,


end:setting.lunch_end



});


}








result.sort((a,b)=>


timeToMinutes(a.start)-timeToMinutes(b.start)


);





setColumns(result);


};












// ================= DELETE =================


const deleteTimetable=async(id)=>{


const confirmDelete=window.confirm(

"Delete this timetable?"

);



if(!confirmDelete) return;







const {

error

}=await supabase


.from("class_timetables")


.delete()


.eq("id",id);






if(error){


alert(error.message);

return;


}







alert("Deleted successfully");


loadTimetable();


};











// ================= DAYS =================


const days=[


...new Set(


timetable.map(item=>item.day_name)


)


];











// ================= CLASSES =================


const classes=[


...new Map(


timetable


.filter(item=>item.classes)


.map(item=>[


item.classes.id,


item.classes


])


).values()


];












// ================= MULTIPLE LESSONS =================


const getLessons=(day,classId,periodId)=>{


return timetable.filter(item=>


item.day_name===day &&


item.classes?.id===classId &&


item.period_id===periodId



);


};
// ================= PRINT TIMETABLE =================

const printTimetable=()=>{


const original=document.getElementById(
"print-area"
);


const clone=original.cloneNode(true);



clone.querySelectorAll(".action-buttons").forEach(item=>{

item.remove();

});




const content=clone.innerHTML;



const win=window.open(
"",
"",
"width=1200,height=800"
);




win.document.write(`

<html>

<head>

<title>Class Timetable</title>


<style>


body{

font-family:Arial;

}


h2,h3{

text-align:center;

}


table{

width:100%;

border-collapse:collapse;

}



th,td{

border:1px solid black;

padding:8px;

text-align:center;

}


th{

background:#111827;

color:white;

}



</style>


</head>


<body>


<h2>

${school?.school_name || "SCHOOL NAME"}

</h2>



<h3>

CLASS TIMETABLE

</h3>



${content}



</body>


</html>


`);



win.document.close();

win.focus();

win.print();


};









if(loading){


return(

<div className="bg-white p-5 rounded-xl">

Loading timetable...

</div>

);


}









return(


<div>






<div className="flex justify-end mb-4 print:hidden">


<button

onClick={printTimetable}

className="bg-green-600 text-white px-5 py-3 rounded-lg"

>

🖨 Print Timetable

</button>


</div>









<div

id="print-area"

className="bg-white rounded-xl shadow overflow-x-auto"

>






<table className="border-collapse w-full">


<thead>


<tr className="bg-slate-900 text-white">



<th className="border p-3">

DAY

</th>




<th className="border p-3">

CLASS

</th>





{


columns.map(col=>(


<th

key={col.id}

className="border p-3 whitespace-nowrap"

>


{col.name}


<div className="text-xs">

{col.start}

-

{col.end}

</div>



</th>


))


}



</tr>


</thead>









<tbody>


{


days.map(day=>(



classes.map((cls,index)=>(



<tr key={day + cls.id}>




{


index===0 &&


<td

rowSpan={classes.length}

className="border p-3 bg-blue-50 font-bold text-center"

>

{day}

</td>


}





<td

className="border p-3 font-semibold"

>


{cls.class_name}



<div className="text-xs text-gray-500">

{cls.academic_level}

</div>


</td>









{


columns.map(col=>{



if(col.type==="break"){


return(

<td

key={col.id}

className="border p-3 bg-yellow-200 font-bold"

>

BREAK

</td>

);


}






if(col.type==="lunch"){


return(

<td

key={col.id}

className="border p-3 bg-orange-200 font-bold"

>

LUNCH

</td>

);


}







const lessons=getLessons(

day,

cls.id,

col.id

);









return(

<td

key={col.id}

className="border p-3 text-center align-top"

>







{


lessons.length > 0 ?



lessons.map(lesson=>(



<div

key={lesson.id}

className="mb-3 pb-2 border-b last:border-none"

>





<div className="font-bold text-blue-700">

{lesson.subjects?.subject_name}

</div>





<div className="text-xs text-gray-600">

{lesson.teachers?.first_name}

{" "}

{lesson.teachers?.last_name}

</div>







<div className="action-buttons mt-2">



<button

onClick={()=>navigate(`/timetable/edit/${lesson.id}`)}

className="bg-blue-600 text-white px-2 py-1 rounded text-xs mr-1"

>

Edit

</button>







<button

onClick={()=>deleteTimetable(lesson.id)}

className="bg-red-600 text-white px-2 py-1 rounded text-xs"

>

Delete

</button>



</div>






</div>



))



:



"-"



}







</td>


);



})


}




</tr>



))


))


}



</tbody>






</table>






</div>







</div>


);


}



export default TimetableTable;