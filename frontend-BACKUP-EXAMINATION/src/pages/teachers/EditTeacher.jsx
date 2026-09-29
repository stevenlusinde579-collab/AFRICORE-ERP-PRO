import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "../../services/supabase";


function EditTeacher(){

  const { id } = useParams();

  const navigate = useNavigate();


  const [loading,setLoading] = useState(true);

  const [saving,setSaving] = useState(false);

  const [message,setMessage] = useState("");




  const [teacher,setTeacher] = useState({

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









  useEffect(()=>{

    getTeacher();

  },[]);









  const getTeacher = async()=>{


    const {data,error}=await supabase

    .from("teachers")

    .select("*")

    .eq("id",id)

    .single();




    if(error){

      console.log(
        "GET TEACHER ERROR:",
        error
      );

    }else{


      setTeacher({

        employee_number:data.employee_number || "",

        first_name:data.first_name || "",

        middle_name:data.middle_name || "",

        last_name:data.last_name || "",

        gender:data.gender || "",

        phone:data.phone || "",

        email:data.email || "",

        employment_date:data.employment_date || "",

        qualification:data.qualification || "",

        specialization:data.specialization || "",

        status:data.status || "Active",

        photo_url:data.photo_url || ""

      });


    }


    setLoading(false);


  };









  const handleChange=(e)=>{


    setTeacher({

      ...teacher,

      [e.target.name]:e.target.value

    });


  };









  const handlePhoto = async(e)=>{


    const file=e.target.files[0];


    if(!file) return;





    const fileName=

    `teachers/${Date.now()}-${file.name}`;







    const {error:uploadError}=await supabase.storage

    .from("teacher-photos")

    .upload(fileName,file);






    if(uploadError){


      console.log(uploadError);


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
      "Photo updated successfully ✅"
    );


  };









  const updateTeacher=async(e)=>{


    e.preventDefault();


    setSaving(true);


    setMessage("");







    const {error}=await supabase

    .from("teachers")

    .update(teacher)

    .eq("id",id);







    if(error){


      console.log(error);


      setMessage(
        "ERROR: "+error.message
      );


    }else{


      setMessage(
        "Teacher updated successfully ✅"
      );



      setTimeout(()=>{

        navigate("/teachers");

      },1500);



    }



    setSaving(false);



  };









if(loading){

return(

<div className="bg-white p-6 rounded-xl shadow">

Loading teacher...

</div>

);

}









return(

<div>



<h1 className="text-3xl font-bold text-gray-800">

Edit Teacher

</h1>



<p className="text-gray-600 mt-2">

Update teacher information

</p>








<form

onSubmit={updateTeacher}

className="bg-white shadow rounded-xl p-6 mt-6"

>








<div className="grid grid-cols-1 md:grid-cols-2 gap-5">







<input

name="employee_number"

value={teacher.employee_number}

onChange={handleChange}

placeholder="Employee Number"

className="border p-3 rounded-lg"

/>









<input

name="first_name"

value={teacher.first_name}

onChange={handleChange}

placeholder="First Name"

className="border p-3 rounded-lg"

/>









<input

name="middle_name"

value={teacher.middle_name}

onChange={handleChange}

placeholder="Middle Name"

className="border p-3 rounded-lg"

/>









<input

name="last_name"

value={teacher.last_name}

onChange={handleChange}

placeholder="Last Name"

className="border p-3 rounded-lg"

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

value={teacher.phone}

onChange={handleChange}

placeholder="Phone"

className="border p-3 rounded-lg"

/>









<input

name="email"

value={teacher.email}

onChange={handleChange}

placeholder="Email"

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

value={teacher.qualification}

onChange={handleChange}

placeholder="Qualification"

className="border p-3 rounded-lg"

/>









<input

name="specialization"

value={teacher.specialization}

onChange={handleChange}

placeholder="Specialization"

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









{teacher.photo_url && (

<div className="mt-5">

<p className="mb-2 font-semibold">

Current Photo

</p>


<img

src={teacher.photo_url}

alt="teacher"

className="w-32 h-32 rounded-full object-cover"

/>

</div>

)}








{

message &&

<div className="mt-5 p-3 bg-gray-100 rounded">

{message}

</div>

}









<div className="flex gap-4 mt-6">







<button

disabled={saving}

className="bg-blue-600 text-white px-6 py-3 rounded-lg"

>


{

saving

?

"Updating..."

:

"Update Teacher"

}


</button>








<button

type="button"

onClick={()=>navigate("/teachers")}

className="bg-gray-600 text-white px-6 py-3 rounded-lg"

>

Cancel

</button>







</div>







</form>






</div>

);


}


export default EditTeacher;