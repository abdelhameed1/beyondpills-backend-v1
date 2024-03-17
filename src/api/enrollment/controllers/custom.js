const _ = require("lodash");
const randomstring = require("randomstring");

module.exports = {
  //POST
  async enroll(ctx) {
    const { userID, programID, referal } = ctx.request.body;
    
    const enrolled = await strapi.entityService.findMany(
      "api::enrollment.enrollment",
      {
        filters: { userID, programID },

      }
    );
    
    if (enrolled.length > 0) {
      return ctx.throw(400, "You are already enrolled in this program");
    } else {
      if (!_.isEmpty(referal)) {
        const referalCode = await strapi.entityService.findMany("api::enrollment-code.enrollment-code", {
          filters :{
            code: referal,
            program : programID
          },
          populate: {hcp: true }
        })
        if(referalCode.length > 0) {
          let hcp 
          if(!_.isEmpty(referalCode[0].hcp)) hcp = referalCode[0].hcp;  
           await strapi.entityService.create(
            "api::enrollment.enrollment",
            {
              data: {
                userID,
                programID,
                hcp,
                status: 'accepted',
                 enrollmentDate: new Date()
              },

            }
          );
          await strapi.entityService.delete("api::enrollment-code.enrollment-code", referalCode[0].id);
          return {
            message: "You have been enrolled in the program",
          }
        
        }else return ctx.throw(400, "incorrect referal code");
        
        }
      } 
      const res = await strapi.entityService.create(
        "api::enrollment.enrollment",
        {
          data: { userID, programID, status: 'pending' , enrollmentDate: new Date()},

        }
      );
      return {
        message: "Your request has been submitted",
        data: res
      };
    

  },
  //GET
  async getPendingEnrollments(ctx) {
    const { userID } = ctx.query;
    const pendingPrograms = await strapi.entityService.findMany("api::enrollment.enrollment", {
      filters: {
        status: 'pending',
      },
      populate: {
        programID: {
          fitlers: {
            user: {
              id: userID
            }
          },
          populate: {
            user: true,

          }
        },
        userID: true
      }
    });

    return {
      data: pendingPrograms
    };
  },

  //GET
  generateReferalCodes : async (ctx) => {
    let { id , numberOfCodes , hcpId} = ctx.query;
    let hcp = null;
    numberOfCodes =  numberOfCodes ? numberOfCodes : 10;
    const program = await strapi.entityService.findOne('api::program.program', id);
    if(hcpId)  hcp = await strapi.entityService.findOne('plugin::users-permissions.user', hcpId);
    
    
    let codesGenerated = [];
    
    for(let i = 0; i < numberOfCodes; i++) {
      codesGenerated.push(randomstring.generate(
        {charset: 'alphanumeric' , 
        length: 6}
      ))
    }

    for( const code of codesGenerated ) { 
      await strapi.entityService.create("api::enrollment-code.enrollment-code", {
        data: {
          program: program.id,
          hcp:  !_.isEmpty(hcp) ? hcp.id : null ,
           code
        }
      })
    }
    return {
      message: "Referal codes generated successfully",
      data: codesGenerated
    }
  } ,

  //GET
  getPatientEnrollments : async (ctx) => {
    const { userID } = ctx.query;
    const enrolledPrograms = await strapi.entityService.findMany("api::enrollment.enrollment", {
      filters: {
        userID,
      },
      populate: {
       
       programID : true
      }
    });

    return {
      data: enrolledPrograms
    };
  }

}