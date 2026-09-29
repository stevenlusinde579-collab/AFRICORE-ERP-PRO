import { useEffect, useState } from "react";
import { supabase } from "../../services/supabase";
import { useNavigate } from "react-router-dom";


function AddExam(){


const navigate = useNavigate();


const [loading,setLoading]=useState(false);

const [years,setYears]=useState([]);





const [form,setForm]=useState({

school_id:1,

academic_year_id:"",

exam_name:"",

exam_type:"Internal",

term:"Term 1",

start_date:"",

end_date:"",

status:"Draft",

total_marks:100,

duration_minutes:120

});









useEffect(()=>{

loadAcademicYears();

},[]);









const loadAcademicYears=async()=>{


const {data,error}=await supabase

.from("academic_years")

.select(

"id,year_name"

)

.order(

"id",

{

ascending:false

}

);





if(error){

console.log(
"YEAR ERROR:",
error
);

return;

}



setYears(data || []);



};









const handleChange=(e)=>{


setForm({

...form,

[e.target.name]:e.target.value

});


};









const saveExam=async(e)=>{


e.preventDefault();


try{


setLoading(true);





// CREATE EXAM PAYLOAD


const payload={


school_id:Number(form.school_id),


academic_year_id:Number(form.academic_year_id),


exam_name:form.exam_name,


exam_type:form.exam_type,


term:form.term,


start_date:form.start_date,


end_date:form.end_date,


status:form.status,


total_marks:Number(form.total_marks),


duration_minutes:Number(form.duration_minutes),


ai_status:"Pending"


};








console.log(
"EXAM PAYLOAD:",
payload
);








// INSERT EXAM


const {

data:examData,

error

}=await supabase

.from("exams")

.insert(payload)

.select();







if(error){

throw error;

}






console.log(

"CREATED EXAM:",

examData

);







const examId=examData[0].id;







// CREATE APPROVAL FLOW AUTOMATICALLY


const {

error:approvalError

}=await supabase

.from("exam_approvals")

.insert({


exam_id:examId,


academic_status:"Pending",


second_master_status:"Pending",


headmaster_status:"Pending",


secretary_status:"Pending"



});







if(approvalError){


console.log(

"APPROVAL CREATE ERROR:",

approvalError

);


}








alert(

"Examination created successfully"

);




navigate(

"/examination/list"

);






}catch(err){



console.log(

"CREATE EXAM ERROR:",

err

);



alert(

err.message

);



}finally{


setLoading(false);


}



};









return(


<div className="bg-white rounded-xl shadow p-6">


<h1 className="text-2xl font-bold mb-6">

Create Examination

</h1>






<form

onSubmit={saveExam}

className="grid md:grid-cols-2 gap-5"

>







<div>


<label className="block mb-1">

Exam Name

</label>


<input


required


name="exam_name"


value={form.exam_name}


onChange={handleChange}


className="w-full border p-2 rounded"


placeholder="Example: Mid Term Examination"


/>


</div>









<div>


<label className="block mb-1">

Exam Type

</label>


<select


name="exam_type"


value={form.exam_type}


onChange={handleChange}


className="w-full border p-2 rounded"


>


<option>Internal</option>

<option>Mock</option>

<option>Terminal</option>

<option>National</option>


</select>


</div>









<div>


<label className="block mb-1">

Academic Year

</label>



<select


required


name="academic_year_id"


value={form.academic_year_id}


onChange={handleChange}


className="w-full border p-2 rounded"


>


<option value="">

Select Year

</option>





{

years.map(year=>(


<option

key={year.id}

value={year.id}

>

{year.year_name}

</option>


))


}



</select>


</div>









<div>


<label className="block mb-1">

Term

</label>



<select


name="term"


value={form.term}


onChange={handleChange}


className="w-full border p-2 rounded"


>


<option>

Term 1

</option>


<option>

Term 2

</option>


<option>

Term 3

</option>



</select>


</div>









<div>


<label>

Start Date

</label>


<input


required


type="date"


name="start_date"


value={form.start_date}


onChange={handleChange}


className="w-full border p-2 rounded"


/>


</div>









<div>


<label>

End Date

</label>


<input


required


type="date"


name="end_date"


value={form.end_date}


onChange={handleChange}


className="w-full border p-2 rounded"


/>


</div>









<div>


<label>

Total Marks

</label>


<input


type="number"


name="total_marks"


value={form.total_marks}


onChange={handleChange}


className="w-full border p-2 rounded"


/>


</div>









<div>


<label>

Duration Minutes

</label>


<input


type="number"


name="duration_minutes"


value={form.duration_minutes}


onChange={handleChange}


className="w-full border p-2 rounded"


/>


</div>









<div className="md:col-span-2 flex gap-4 mt-5">





<button


disabled={loading}


className="bg-blue-600 text-white px-6 py-2 rounded"


>


{

loading

?

"Saving..."

:

"Save Examination"


}


</button>







<button


type="button"


onClick={()=>navigate("/examination/list")}


className="bg-gray-500 text-white px-6 py-2 rounded"


>


Cancel


</button>





</div>






</form>






</div>


);


}



export default AddExam;