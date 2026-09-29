// frontend/src/pages/examination/EditExam.jsx


import { 
    useEffect,
    useState
} from "react";


import axios from "axios";


import {
    useParams,
    useNavigate
} from "react-router-dom";



const API_URL = "http://localhost:5000/api/exams";





function EditExam(){


    const { examId } = useParams();

    const navigate = useNavigate();



    const [form,setForm] = useState({

        exam_name:"",
        exam_type:"",
        term:"",
        start_date:"",
        end_date:"",
        duration_minutes:"",
        total_marks:"",
        status:"Draft"

    });



    const [loading,setLoading] = useState(true);

    const [saving,setSaving] = useState(false);

    const [error,setError] = useState("");









// ==================================
// LOAD EXAM
// ==================================


const loadExam = async()=>{


    try{


        const response = await axios.get(

            `${API_URL}/${examId}`

        );



        const exam = response.data.exam;



        setForm({

            exam_name: exam.exam_name || "",

            exam_type: exam.exam_type || "",

            term: exam.term || "",

            start_date: exam.start_date || "",

            end_date: exam.end_date || "",

            duration_minutes: exam.duration_minutes || "",

            total_marks: exam.total_marks || "",

            status: exam.status || "Draft"


        });



    }catch(err){


        console.log(
            "EDIT LOAD ERROR:",
            err
        );


        setError(
            "Failed to load exam"
        );


    }finally{


        setLoading(false);


    }



};







useEffect(()=>{


    loadExam();


},[]);











// ==================================
// HANDLE INPUT
// ==================================


const handleChange=(e)=>{


    setForm({

        ...form,

        [e.target.name]:e.target.value

    });


};









// ==================================
// UPDATE EXAM
// ==================================


const updateExam = async(e)=>{


    e.preventDefault();



    try{


        setSaving(true);



        await axios.put(

            `${API_URL}/${examId}`,

            form

        );



        alert(
            "Exam updated successfully"
        );



        navigate(

            `/examination/${examId}`

        );




    }catch(err){


        console.log(
            "UPDATE ERROR:",
            err
        );


        alert(
            "Failed to update exam"
        );


    }finally{


        setSaving(false);


    }



};










if(loading){


return(

<div className="p-6">

Loading exam...

</div>

);


}








return(


<div className="p-6">



<h1 className="
text-3xl
font-bold
mb-6
">

Edit Examination

</h1>





{
error &&

<div className="
bg-red-100
text-red-700
p-3
rounded
mb-5
">

{error}

</div>

}









<form

onSubmit={updateExam}

className="
bg-white
shadow
rounded-xl
p-6
grid
grid-cols-1
md:grid-cols-2
gap-5
"

>





<div>


<label>

Exam Name

</label>


<input

name="exam_name"

value={form.exam_name}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

/>


</div>








<div>


<label>

Exam Type

</label>


<select

name="exam_type"

value={form.exam_type}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

>


<option>

Internal

</option>


<option>

Mock

</option>


<option>

Terminal

</option>


</select>


</div>









<div>


<label>

Term

</label>


<input

name="term"

value={form.term}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

/>


</div>









<div>


<label>

Status

</label>


<select

name="status"

value={form.status}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

>


<option>

Draft

</option>


<option>

Published

</option>


<option>

Completed

</option>


</select>


</div>









<div>


<label>

Start Date

</label>


<input

type="date"

name="start_date"

value={form.start_date}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

/>


</div>









<div>


<label>

End Date

</label>


<input

type="date"

name="end_date"

value={form.end_date}

onChange={handleChange}

className="
border
p-3
rounded
w-full
"

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

className="
border
p-3
rounded
w-full
"

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

className="
border
p-3
rounded
w-full
"

/>


</div>









<div className="
md:col-span-2
flex
gap-4
mt-5
">





<button

type="button"

onClick={()=>navigate(-1)}

className="
bg-gray-300
px-6
py-3
rounded
"

>

Cancel

</button>







<button

disabled={saving}

className="
bg-blue-600
text-white
px-6
py-3
rounded
"

>

{

saving

?

"Saving..."

:

"Update Exam"

}


</button>





</div>





</form>





</div>


);


}



export default EditExam;