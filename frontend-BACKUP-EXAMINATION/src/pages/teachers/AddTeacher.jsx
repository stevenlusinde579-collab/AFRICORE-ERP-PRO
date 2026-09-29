import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function AddTeacher(){

  const navigate = useNavigate();


  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState("");



  const [teacher,setTeacher] = useState({

    school_id:1,

    employee_number:"",
    first_name:"",
    middle_name:"",
    last_name:"",

    gender:"",

    phone:"",
    email:"",

    employment_date:"",

    qualification:"",

    specialization:"",

    status:"Active",

    photo_url:""

  });







  const handleChange=(e)=>{


    setTeacher({

      ...teacher,

      [e.target.name]:e.target.value

    });


  };









  const handlePhoto = async(e)=>{


    const file = e.target.files[0];


    if(!file) return;





    const fileName =

    `teachers/${Date.now()}-${file.name}`;






    const {error:uploadError}=await supabase.storage

    .from("teacher-photos")

    .upload(fileName,file);






    if(uploadError){


      console.log(
        "UPLOAD ERROR:",
        uploadError
      );


      setMessage(
        "Photo upload failed: "
        +
        uploadError.message
      );


      return;

    }








    const {data}=supabase.storage

    .from("teacher-photos")

    .getPublicUrl(fileName);







    setTeacher({

      ...teacher,

      photo_url:data.publicUrl

    });




    setMessage(
      "Photo uploaded successfully ✅"
    );



  };












  const saveTeacher = async(e)=>{


    e.preventDefault();


    setLoading(true);


    setMessage("");







    const {error}=await supabase

    .from("teachers")

    .insert([teacher]);







    if(error){


      console.log(
        "SAVE ERROR:",
        error
      );


      setMessage(
        "ERROR: "+error.message
      );



    }

    else{


      setMessage(
        "Teacher saved successfully ✅"
      );



      setTimeout(()=>{

        navigate("/teachers");

      },1500);



    }






    setLoading(false);


  };












return(


<div>






<h1 className="text-3xl font-bold text-gray-800">

Add New Teacher

</h1>



<p className="text-gray-600 mt-2">

Register teacher into AfriCore ERP PRO

</p>









<form

onSubmit={saveTeacher}

className="bg-white shadow rounded-xl p-6 mt-6"

>






<div className="grid grid-cols-1 md:grid-cols-2 gap-5">








<input

name="employee_number"

placeholder="Employee Number"

value={teacher.employee_number}

onChange={handleChange}

className="border p-3 rounded-lg"

required

/>








<input

name="first_name"

placeholder="First Name"

value={teacher.first_name}

onChange={handleChange}

className="border p-3 rounded-lg"

required

/>








<input

name="middle_name"

placeholder="Middle Name"

value={teacher.middle_name}

onChange={handleChange}

className="border p-3 rounded-lg"

/>








<input

name="last_name"

placeholder="Last Name"

value={teacher.last_name}

onChange={handleChange}

className="border p-3 rounded-lg"

required

/>









<select

name="gender"

value={teacher.gender}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="">

Select Gender

</option>


<option value="Male">

Male

</option>


<option value="Female">

Female

</option>


</select>









<input

name="phone"

placeholder="Phone"

value={teacher.phone}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<input

name="email"

placeholder="Email"

value={teacher.email}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<input

type="date"

name="employment_date"

value={teacher.employment_date}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<input

name="qualification"

placeholder="Qualification"

value={teacher.qualification}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<input

name="specialization"

placeholder="Specialization"

value={teacher.specialization}

onChange={handleChange}

className="border p-3 rounded-lg"

/>









<select

name="status"

value={teacher.status}

onChange={handleChange}

className="border p-3 rounded-lg"

>


<option value="Active">

Active

</option>


<option value="Inactive">

Inactive

</option>


</select>









<input

type="file"

accept="image/*"

onChange={handlePhoto}

className="border p-3 rounded-lg"

/>








</div>









{

message &&

<div className="mt-5 p-3 bg-gray-100 rounded">

{message}

</div>

}









<div className="flex gap-4 mt-6">







<button

type="submit"

disabled={loading}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

loading

?

"Saving..."

:

"Save Teacher"

}


</button>









<button

type="button"

onClick={()=>navigate("/teachers")}

className="bg-gray-600 text-white px-6 py-3 rounded-lg"

>

Back

</button>








</div>







</form>







</div>


);


}


export default AddTeacher;