import { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";


function StudentView(){

    const { id } = useParams();

    const navigate = useNavigate();



    useEffect(()=>{

        navigate(`/students/profile/${id}`);

    },[id,navigate]);



    return (

        <div className="p-6">

            Loading student profile...

        </div>

    );

}


export default StudentView;