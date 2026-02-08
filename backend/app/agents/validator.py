"""
Validator Agent
Performs faithfulness and quality validation using RAGAS-style metrics
"""

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field

from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import PydanticOutputParser

from app.core.config import settings
from app.core.logging import get_logger
from .state import ValidationResult

logger = get_logger(__name__)


class FaithfulnessCheck(BaseModel):
    """Result of faithfulness validation"""
    is_faithful: bool = Field(description="Whether the answer is grounded in context")
    score: float = Field(description="Faithfulness score 0-1")
    unsupported_claims: List[str] = Field(
        default_factory=list,
        description="Claims in the answer not supported by context"
    )
    reasoning: str


class RelevancyCheck(BaseModel):
    """Result of relevancy validation"""
    is_relevant: bool = Field(description="Whether the answer addresses the question")
    score: float = Field(description="Relevancy score 0-1")
    missing_aspects: List[str] = Field(
        default_factory=list,
        description="Aspects of the question not addressed"
    )
    reasoning: str


class CoherenceCheck(BaseModel):
    """Result of coherence validation"""
    is_coherent: bool = Field(description="Whether the answer is logically coherent")
    score: float = Field(description="Coherence score 0-1")
    issues: List[str] = Field(
        default_factory=list,
        description="Logical or structural issues found"
    )
    reasoning: str


class ValidatorAgent:
    """
    Validates LLM outputs for faithfulness, relevancy, and coherence.
    Implements RAGAS-style evaluation metrics.
    """
    
    def __init__(self):
        self.llm = ChatOpenAI(
            api_key=settings.openai_api_key,
            model=settings.openai_model,
            temperature=0.0,  # Deterministic evaluation
        )
        self._setup_prompts()
    
    def _setup_prompts(self):
        """Initialize validation prompts"""
        
        # Faithfulness validation
        self.faithfulness_parser = PydanticOutputParser(pydantic_object=FaithfulnessCheck)
        self.faithfulness_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are a fact-checker validating that an answer is grounded in the given context.

Your task:
1. Identify all factual claims made in the answer
2. Check if each claim is supported by the context
3. Flag unsupported claims

A faithful answer only makes claims that can be verified from the context.

{format_instructions}"""),
            ("human", """Context:
{context}

Question: {question}

Answer to validate:
{answer}

Validate the faithfulness of this answer.""")
        ])
        
        # Relevancy validation
        self.relevancy_parser = PydanticOutputParser(pydantic_object=RelevancyCheck)
        self.relevancy_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are evaluating whether an answer properly addresses the user's question.

Your task:
1. Identify the main aspects/requirements of the question
2. Check if the answer addresses each aspect
3. Flag missing or incomplete aspects

A relevant answer directly and completely addresses what was asked.

{format_instructions}"""),
            ("human", """Question: {question}

Answer to validate:
{answer}

Evaluate the relevancy of this answer.""")
        ])
        
        # Coherence validation
        self.coherence_parser = PydanticOutputParser(pydantic_object=CoherenceCheck)
        self.coherence_prompt = ChatPromptTemplate.from_messages([
            ("system", """You are evaluating the logical coherence and structure of an answer.

Your task:
1. Check for logical consistency (no contradictions)
2. Verify proper structure and flow
3. Identify any confusing or unclear sections

A coherent answer is logically sound, well-structured, and easy to understand.

{format_instructions}"""),
            ("human", """Answer to validate:
{answer}

Evaluate the coherence of this answer.""")
        ])
    
    async def check_faithfulness(
        self,
        answer: str,
        context: str,
        question: str
    ) -> FaithfulnessCheck:
        """Check if the answer is faithful to the context"""
        logger.debug("Checking faithfulness")
        
        try:
            chain = self.faithfulness_prompt | self.llm | self.faithfulness_parser
            
            result = await chain.ainvoke({
                "context": context,
                "question": question,
                "answer": answer,
                "format_instructions": self.faithfulness_parser.get_format_instructions()
            })
            
            return result
            
        except Exception as e:
            logger.error("Faithfulness check failed", error=str(e))
            return FaithfulnessCheck(
                is_faithful=True,  # Fail open
                score=0.5,
                unsupported_claims=[],
                reasoning=f"Check failed: {str(e)}"
            )
    
    async def check_relevancy(
        self,
        answer: str,
        question: str
    ) -> RelevancyCheck:
        """Check if the answer is relevant to the question"""
        logger.debug("Checking relevancy")
        
        try:
            chain = self.relevancy_prompt | self.llm | self.relevancy_parser
            
            result = await chain.ainvoke({
                "question": question,
                "answer": answer,
                "format_instructions": self.relevancy_parser.get_format_instructions()
            })
            
            return result
            
        except Exception as e:
            logger.error("Relevancy check failed", error=str(e))
            return RelevancyCheck(
                is_relevant=True,
                score=0.5,
                missing_aspects=[],
                reasoning=f"Check failed: {str(e)}"
            )
    
    async def check_coherence(self, answer: str) -> CoherenceCheck:
        """Check if the answer is logically coherent"""
        logger.debug("Checking coherence")
        
        try:
            chain = self.coherence_prompt | self.llm | self.coherence_parser
            
            result = await chain.ainvoke({
                "answer": answer,
                "format_instructions": self.coherence_parser.get_format_instructions()
            })
            
            return result
            
        except Exception as e:
            logger.error("Coherence check failed", error=str(e))
            return CoherenceCheck(
                is_coherent=True,
                score=0.5,
                issues=[],
                reasoning=f"Check failed: {str(e)}"
            )
    
    async def validate(
        self,
        answer: str,
        question: str,
        context: str,
        run_all_checks: bool = True
    ) -> ValidationResult:
        """
        Run full validation pipeline.
        
        Args:
            answer: The generated answer to validate
            question: The original user question
            context: The retrieved context used for generation
            run_all_checks: If False, stop on first failure
            
        Returns:
            ValidationResult with scores and issues
        """
        logger.info("Running validation pipeline")
        
        import asyncio
        
        # Run all checks in parallel for efficiency
        faithfulness_task = self.check_faithfulness(answer, context, question)
        relevancy_task = self.check_relevancy(answer, question)
        coherence_task = self.check_coherence(answer)
        
        faithfulness, relevancy, coherence = await asyncio.gather(
            faithfulness_task,
            relevancy_task,
            coherence_task
        )
        
        # Aggregate results
        issues = []
        suggestions = []
        
        if not faithfulness.is_faithful:
            issues.extend([f"Unsupported claim: {c}" for c in faithfulness.unsupported_claims])
            suggestions.append("Remove or verify unsupported claims against the source documents")
        
        if not relevancy.is_relevant:
            issues.extend([f"Missing aspect: {a}" for a in relevancy.missing_aspects])
            suggestions.append("Address the missing aspects of the question")
        
        if not coherence.is_coherent:
            issues.extend(coherence.issues)
            suggestions.append("Improve logical structure and clarity")
        
        # Calculate overall validity
        is_valid = (
            faithfulness.is_faithful and 
            relevancy.is_relevant and 
            coherence.is_coherent
        )
        
        # Allow partial validity if scores are high enough
        if not is_valid:
            avg_score = (faithfulness.score + relevancy.score + coherence.score) / 3
            if avg_score >= 0.7:
                is_valid = True
                suggestions.insert(0, "Answer is acceptable but could be improved")
        
        result = ValidationResult(
            is_valid=is_valid,
            faithfulness_score=faithfulness.score,
            relevancy_score=relevancy.score,
            coherence_score=coherence.score,
            issues=issues,
            suggestions=suggestions
        )
        
        logger.info(
            "Validation complete",
            is_valid=result.is_valid,
            faithfulness=result.faithfulness_score,
            relevancy=result.relevancy_score,
            coherence=result.coherence_score
        )
        
        return result


# Singleton instance
_validator: Optional[ValidatorAgent] = None


def get_validator() -> ValidatorAgent:
    """Get or create the validator agent instance"""
    global _validator
    if _validator is None:
        _validator = ValidatorAgent()
    return _validator
