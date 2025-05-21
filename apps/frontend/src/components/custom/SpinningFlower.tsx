import React from "react";

export const FlowerSpinner = () => {
  return (
    <div className="lg:flex hidden">
      <div className="flex flex-col items-center justify-center">
        <div className="flex flex-wrap justify-between items-center w-[170px] h-[180px] hover:windmillclose windmillfar">
          <div>
            <div
              className="bg-white w-[80px] h-[80px] rounded-tr-[50%] rounded-br-[100%] rounded-bl-[40%] rounded-tl-[30%] bg-gradient-to-b"
              style={{
                transform: "rotate(180deg)",
                background:
                  "linear-gradient(rgba(239, 68, 68, 0.5), rgb(252, 165, 165))",
              }}
            ></div>
          </div>
          <div>
            <div
              className="bg-white w-[80px] h-[80px] rounded-tr-[50%] rounded-br-[100%] rounded-bl-[40%] rounded-tl-[30%] bg-gradient-to-b"
              style={{
                transform: "rotate(270deg)",
                background:
                  "linear-gradient(rgba(239, 68, 68, 0.5), rgb(252, 165, 165))",
              }}
            ></div>
          </div>
          <div>
            <div
              className="bg-white w-[80px] h-[80px] rounded-tr-[50%] rounded-br-[100%] rounded-bl-[40%] rounded-tl-[30%] bg-gradient-to-b"
              style={{
                transform: "rotate(90deg)",
                background:
                  "linear-gradient(rgba(239, 68, 68, 0.5), rgb(252, 165, 165))",
              }}
            ></div>
          </div>
          <div>
            <div
              className="bg-white w-[80px] h-[80px] rounded-tr-[50%] rounded-br-[100%] rounded-bl-[40%] rounded-tl-[30%] bg-gradient-to-b"
              style={{
                transform: "rotate(0deg)",
                background:
                  "linear-gradient(rgba(239, 68, 68, 0.5), rgb(252, 165, 165))",
              }}
            ></div>
          </div>
        </div>{" "}
        <div className="mt-[-90px] relative z-10">
          <div className="w-[10px] mx-auto rounded-t-md rounded-sm h-[200px] bg-red-300/50 bg-opacity-70"></div>
        </div>
      </div>
    </div>
  );
};
